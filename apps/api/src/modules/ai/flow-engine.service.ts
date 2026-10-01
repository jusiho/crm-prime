import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  AiMode,
  ConversationStatus,
  MessageAuthor,
  MessageType,
  type FlowEdge,
  type FlowNode,
  type FlowTriggerConfig,
  type FlowTriggerType,
} from "@crm/shared";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { currentOrgId } from "../../infra/tenant/tenant.context";
import { TenantService } from "../../infra/tenant/tenant.service";
import { QUEUE_FLOW } from "../../infra/queue/queue.constants";
import { MessagingService } from "../messaging/messaging.service";
import { AutopilotService } from "./autopilot.service";
import { parseTriggerConfig } from "./flow.service";

const MAX_STEPS = 50; // cortafuegos anti-bucle

type Vars = Record<string, string>;

/**
 * Motor de ejecución de flujos visuales. Recorre el grafo (nodos + aristas)
 * por cada conversación, manteniendo el estado en FlowSession:
 *  - envía mensajes, hace preguntas (y espera la respuesta), ramifica por
 *    condición y ejecuta acciones (IA, handoff, etiqueta, mover deal).
 * Tiene prioridad sobre el autopilot mientras la sesión está activa.
 */
@Injectable()
export class FlowEngineService {
  private readonly logger = new Logger("FlowEngine");

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly messaging: MessagingService,
    private readonly autopilot: AutopilotService,
    @InjectQueue(QUEUE_FLOW) private readonly flowQueue: Queue,
    private readonly events: EventEmitter2,
  ) {}

  // ── Conversación nueva: ¿arranca un flujo "al iniciar"? ─────
  async onCreated(conversationId: string): Promise<boolean> {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });
    if (!convo || !convo.contact.optIn) return false;

    // Nace desde un anuncio Click-to-WhatsApp: ese disparador va primero.
    if (convo.referral) {
      const ad = await this.findFlow(convo.channelId, "ad_click");
      if (ad) {
        await this.startFlow(ad, conversationId, "");
        return true;
      }
    }

    const flow = await this.findFlow(convo.channelId, "conversation_start");
    if (!flow) return false;
    await this.startFlow(flow, conversationId, "");
    return true;
  }

  // ── Disparadores por eventos del CRM (no por un mensaje) ────
  /** Lead nuevo: de un formulario de Meta Lead Ads, o por webhook/API. */
  async onLead(
    contactId: string,
    via: "meta" | "webhook" | "api",
    form: { formName: string | null; formId: string | null },
  ): Promise<void> {
    const type: FlowTriggerType = via === "meta" ? "meta_lead" : "lead_webhook";
    await this.onContactEvent(contactId, type, (f) => {
      if (type !== "meta_lead" || f.triggerConfig.forms.length === 0) return true;
      const wanted = f.triggerConfig.forms.map((x) => x.toLowerCase());
      return [form.formName, form.formId].some((v) => !!v && wanted.includes(v.toLowerCase()));
    });
  }

  async onTagAdded(contactId: string, tag: string): Promise<void> {
    await this.onContactEvent(
      contactId,
      "tag_added",
      (f) => f.triggerConfig.tags.length === 0 || f.triggerConfig.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
    );
  }

  async onDealStage(contactId: string, stageId: string): Promise<void> {
    await this.onContactEvent(
      contactId,
      "deal_stage",
      (f) => f.triggerConfig.stageIds.length === 0 || f.triggerConfig.stageIds.includes(stageId),
    );
  }

  async onClosed(conversationId: string): Promise<void> {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });
    if (!convo || !convo.contact.optIn) return;
    const flow = await this.findFlow(convo.channelId, "conversation_closed");
    if (flow) await this.startIfIdle(flow, conversationId);
  }

  /**
   * Le escribimos (una persona, la IA o un flujo): si hay un flujo «sin
   * respuesta», se programa la comprobación para dentro de sus horas.
   */
  async onOutbound(conversationId: string, messageId: string, _author: string): Promise<void> {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { channelId: true, orgId: true },
    });
    if (!convo) return;
    const flow = await this.findFlow(convo.channelId, "no_reply");
    if (!flow) return;
    await this.flowQueue.add(
      "no_reply",
      { conversationId, orgId: convo.orgId, messageId },
      { delay: flow.triggerConfig.hours * 3600_000, jobId: `no-reply-${messageId}` },
    );
  }

  /** Venció el plazo: ¿sigue sin contestar y sigue siendo nuestro último mensaje? */
  async checkNoReply(conversationId: string, messageId: string): Promise<void> {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });
    if (!convo || !convo.contact.optIn || convo.status === ConversationStatus.CLOSED) return;
    // Desempate por id (cuid, creciente): dos mensajes en el mismo milisegundo
    // no deben decidir al azar cuál fue el último.
    const last = await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    // Respondió, o le escribimos otra vez (ese mensaje trae su propio aviso).
    if (!last || last.id !== messageId) return;
    const flow = await this.findFlow(convo.channelId, "no_reply");
    if (!flow) return;
    // Una vez por silencio: si este flujo ya corrió desde el último mensaje
    // del cliente, no se repite (si no, se dispararía con sus propios mensajes).
    const [session, lastInbound] = await Promise.all([
      this.prisma.flowSession.findUnique({ where: { conversationId } }),
      this.prisma.message.findFirst({
        where: { conversationId, direction: "INBOUND" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { createdAt: true },
      }),
    ]);
    if (session && session.flowId === flow.id && (!lastInbound || session.updatedAt > lastInbound.createdAt)) return;
    await this.startIfIdle(flow, conversationId);
  }

  /**
   * Un evento del contacto (lead, etiqueta, etapa) se atiende en su
   * conversación abierta más reciente; si no tiene, se abre una. Así el flujo
   * puede etiquetar, mover el embudo, avisar por HTTP o mandarle una plantilla.
   */
  private async onContactEvent(
    contactId: string,
    type: FlowTriggerType,
    pick: (f: FlowRow) => boolean,
  ): Promise<void> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      select: { optIn: true, orgId: true },
    });
    if (!contact?.optIn) return;
    const open = await this.prisma.conversation.findFirst({
      where: { contactId, status: { not: ConversationStatus.CLOSED } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, channelId: true },
    });
    const flow = await this.findFlow(open?.channelId ?? null, type, undefined, pick);
    if (!flow) return;
    const conversationId =
      open?.id ??
      (
        await this.prisma.conversation.create({
          data: { orgId: contact.orgId, contactId, status: ConversationStatus.OPEN },
        })
      ).id;
    await this.startIfIdle(flow, conversationId);
  }

  /** Arranca el flujo salvo que otro esté a medias (esperando respuesta o un temporizador). */
  private async startIfIdle(flow: FlowRow, conversationId: string): Promise<void> {
    const session = await this.prisma.flowSession.findUnique({ where: { conversationId } });
    const busy =
      !!session &&
      (session.status === "waiting_timer" || (session.status === "running" && !!session.currentNodeId));
    if (busy) {
      this.logger.log(`Flujo "${flow.name}" no arranca en ${conversationId}: hay otro flujo a medias`);
      return;
    }
    await this.startFlow(flow, conversationId, await this.lastInboundText(conversationId));
  }

  // ── Entrante: reanudar sesión o disparar flujo por palabra ──
  // Devuelve true si el flujo manejó el mensaje (el autopilot no debe correr).
  async onInbound(conversationId: string): Promise<boolean> {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });
    if (!convo || !convo.contact.optIn) return false;

    const text = await this.lastInboundText(conversationId);
    const session = await this.prisma.flowSession.findUnique({
      where: { conversationId },
    });

    // Flujo pausado en un "Esperar": ignorar el mensaje hasta que venza el timer.
    if (session && session.status === "waiting_timer") return true;

    // Sesión esperando respuesta a una pregunta → reanudar.
    if (session && session.status === "running" && session.currentNodeId) {
      const flow = await this.loadFlow(session.flowId);
      if (!flow) return false;
      await this.resume(flow, conversationId, session.currentNodeId, text, {
        ...((session.variables as Vars | null) ?? {}),
      });
      return true;
    }

    // Sin sesión activa → ¿algún flujo por palabra clave coincide?
    const flow = await this.findFlow(convo.channelId, "keyword", text);
    if (flow) {
      await this.startFlow(flow, conversationId, text);
      return true;
    }
    return false;
  }

  // ── Arranque / reanudación ──────────────────────────────────
  private async startFlow(
    flow: FlowRow,
    conversationId: string,
    lastText: string,
  ): Promise<void> {
    await this.prisma.flowSession.upsert({
      where: { conversationId },
      create: {
        conversationId,
        flowId: flow.id,
        variables: {},
        status: "running",
      },
      update: {
        flowId: flow.id,
        variables: {},
        status: "running",
        currentNodeId: null,
      },
    });
    const start = flow.nodes.find((n) => n.type === "start");
    const firstId = start
      ? this.nextNodeId(flow.edges, start.id)
      : (flow.nodes[0]?.id ?? null);
    this.logger.log(`Flujo "${flow.name}" iniciado en ${conversationId}`);
    try {
      await this.walk(flow, conversationId, firstId, lastText, {});
    } catch (e) {
      // Un bloque que falla (p. ej. un mensaje fuera de la ventana de 24 h)
      // no deja la sesión colgada en "running": queda parada y en el log.
      this.logger.warn(`Flujo "${flow.name}" se detuvo en ${conversationId}: ${(e as Error).message}`);
      await this.persist(conversationId, null, {}, "stopped").catch(() => undefined);
    }
  }

  private async resume(
    flow: FlowRow,
    conversationId: string,
    waitingNodeId: string,
    text: string,
    vars: Vars,
  ): Promise<void> {
    const node = flow.nodes.find((n) => n.id === waitingNodeId);
    // Guardar la respuesta en la variable indicada por la pregunta.
    if (node?.type === "askQuestion" && node.data.variable) {
      vars[node.data.variable] = text;
    }
    const nextId = node ? this.nextNodeId(flow.edges, node.id) : null;
    await this.walk(flow, conversationId, nextId, text, vars);
  }

  // ── Recorrido del grafo ─────────────────────────────────────
  private async walk(
    flow: FlowRow,
    conversationId: string,
    startId: string | null,
    lastText: string,
    vars: Vars,
  ): Promise<void> {
    let current = startId;
    let steps = 0;

    while (current && steps < MAX_STEPS) {
      steps++;
      const node = flow.nodes.find((n) => n.id === current);
      if (!node) break;

      if (node.type === "start") {
        current = this.nextNodeId(flow.edges, node.id);
        continue;
      }

      if (node.type === "sendMessage") {
        await this.send(conversationId, this.interpolate(node.data.text, vars));
        current = this.nextNodeId(flow.edges, node.id);
        continue;
      }

      if (node.type === "sendTemplate") {
        await this.sendTemplate(conversationId, node.data.templateId);
        current = this.nextNodeId(flow.edges, node.id);
        continue;
      }

      if (node.type === "askQuestion") {
        await this.send(conversationId, this.interpolate(node.data.text, vars));
        // Esperar la respuesta: persistir el nodo actual y parar.
        await this.persist(conversationId, node.id, vars, "running");
        return;
      }

      if (node.type === "condition") {
        const handle = this.evalCondition(node, lastText);
        current = this.nextNodeId(flow.edges, node.id, handle);
        continue;
      }

      if (node.type === "action") {
        const stop = await this.execAction(node, conversationId, vars);
        if (stop) {
          await this.persist(conversationId, null, vars, "stopped");
          return;
        }
        current = this.nextNodeId(flow.edges, node.id);
        continue;
      }

      if (node.type === "delay") {
        // Pausar: persistir el siguiente nodo y programar la reanudación.
        const nextId = this.nextNodeId(flow.edges, node.id);
        const ms = this.delayMs(node);
        if (!nextId || ms <= 0) {
          current = nextId;
          continue;
        }
        await this.persist(conversationId, nextId, vars, "waiting_timer");
        await this.flowQueue.add(
          "resume",
          // La empresa viaja en el trabajo: el worker no tiene otra forma de
          // saberla sin consultar la conversación.
          { conversationId, orgId: currentOrgId() ?? undefined },
          { delay: ms },
        );
        return;
      }

      if (node.type === "http") {
        await this.execHttp(node, vars);
        current = this.nextNodeId(flow.edges, node.id);
        continue;
      }

      if (node.type === "assign") {
        if (node.data.agentId) {
          await this.messaging
            .assignConversation(conversationId, node.data.agentId)
            .catch(() => undefined);
        }
        current = this.nextNodeId(flow.edges, node.id);
        continue;
      }

      if (node.type === "jumpToFlow") {
        const target = node.data.flowId
          ? await this.loadFlow(node.data.flowId)
          : null;
        if (!target) break;
        await this.prisma.flowSession.update({
          where: { conversationId },
          data: { flowId: target.id },
        });
        const start = target.nodes.find((n) => n.type === "start");
        const firstId = start
          ? this.nextNodeId(target.edges, start.id)
          : (target.nodes[0]?.id ?? null);
        await this.walk(target, conversationId, firstId, lastText, vars);
        return;
      }

      break;
    }

    // Fin del flujo (sin más nodos): completado.
    await this.persist(conversationId, null, vars, "completed");
  }

  // Reanuda un flujo tras vencer un bloque "Esperar".
  async resumeTimer(conversationId: string): Promise<void> {
    const session = await this.prisma.flowSession.findUnique({
      where: { conversationId },
    });
    if (!session || session.status !== "waiting_timer" || !session.currentNodeId) {
      return;
    }
    const flow = await this.loadFlow(session.flowId);
    if (!flow) return;
    const text = await this.lastInboundText(conversationId);
    await this.persist(
      conversationId,
      session.currentNodeId,
      { ...((session.variables as Vars | null) ?? {}) },
      "running",
    );
    await this.walk(
      flow,
      conversationId,
      session.currentNodeId,
      text,
      { ...((session.variables as Vars | null) ?? {}) },
    );
  }

  private delayMs(node: FlowNode): number {
    const v = node.data.delayValue ?? 0;
    const unit = node.data.delayUnit ?? "minutes";
    return unit === "hours" ? v * 3600_000 : v * 60_000;
  }

  // Petición HTTP a una API/webhook externa (p. ej. n8n).
  private async execHttp(node: FlowNode, vars: Vars): Promise<void> {
    const url = this.interpolate(node.data.url, vars);
    if (!url) return;
    try {
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      if (node.data.headers?.trim()) {
        headers = { ...headers, ...JSON.parse(node.data.headers) };
      }
      const method = node.data.method ?? "POST";
      const body =
        method === "GET" || method === "DELETE"
          ? undefined
          : this.interpolate(node.data.httpBody, vars) || JSON.stringify(vars);
      const res = await fetch(url, { method, headers, body });
      const responseText = (await res.text()).slice(0, 2000);
      if (node.data.saveAs) vars[node.data.saveAs] = responseText;
    } catch (e) {
      this.logger.warn(`HTTP del flujo falló: ${(e as Error).message}`);
      if (node.data.saveAs) vars[node.data.saveAs] = "";
    }
  }

  // ── Acciones del nodo "action" ──────────────────────────────
  // Devuelve true si el flujo debe detenerse tras la acción.
  private async execAction(
    node: FlowNode,
    conversationId: string,
    vars: Vars,
  ): Promise<boolean> {
    const action = node.data.action;
    if (action === "ai") {
      await this.messaging.setAiMode(conversationId, AiMode.AUTOPILOT);
      // Persistir antes de delegar para no pisar el estado.
      await this.persist(conversationId, null, vars, "stopped");
      await this.autopilot.run(conversationId);
      return true;
    }
    if (action === "handoff") {
      await this.messaging.setStatus(conversationId, ConversationStatus.PENDING);
      return true;
    }
    if (action === "tag" && node.data.tag?.trim()) {
      await this.applyTag(conversationId, node.data.tag.trim());
      return false;
    }
    if (action === "move_deal" && node.data.stageId) {
      await this.moveDeal(conversationId, node.data.stageId);
      return false;
    }
    return false;
  }

  private async applyTag(conversationId: string, name: string): Promise<void> {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { orgId: true, contactId: true },
    });
    if (!convo) return;
    const tag = await this.prisma.tag.upsert({
      where: { orgId_name: { orgId: convo.orgId, name } },
      create: { orgId: convo.orgId, name },
      update: {},
    });
    const added = await this.prisma.contactTag
      .create({ data: { contactId: convo.contactId, tagId: tag.id } })
      .then(() => true)
      .catch(() => false); // ya existía
    if (added) {
      this.events.emit("contact.tagged", { orgId: convo.orgId, contactId: convo.contactId, tag: name });
    }
  }

  private async moveDeal(conversationId: string, stageId: string): Promise<void> {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { contactId: true },
    });
    if (!convo) return;
    const deal = await this.prisma.deal.findFirst({
      where: { contactId: convo.contactId, discardedAt: null },
      orderBy: { updatedAt: "desc" },
    });
    if (deal) {
      await this.prisma.deal.update({
        where: { id: deal.id },
        data: { stageId },
      });
      this.events.emit("deal.stage_changed", {
        orgId: deal.orgId,
        dealId: deal.id,
        contactId: convo.contactId,
        stageId,
      });
    }
  }

  // ── Utilidades del grafo ────────────────────────────────────
  private nextNodeId(
    edges: FlowEdge[],
    nodeId: string,
    handle?: string,
  ): string | null {
    const outgoing = edges.filter((e) => e.source === nodeId);
    if (handle) {
      const byHandle = outgoing.find((e) => e.sourceHandle === handle);
      if (byHandle) return byHandle.target;
      // "else": acepta la rama explícita o la arista sin handle.
      const fallback = outgoing.find(
        (e) => e.sourceHandle === "else" || !e.sourceHandle,
      );
      return fallback?.target ?? null;
    }
    return outgoing[0]?.target ?? null;
  }

  private evalCondition(node: FlowNode, text: string): string {
    const t = text.toLowerCase();
    const branches = node.data.branches ?? [];
    const hit = branches.find((b) =>
      b.keywords.some((k) => t.includes(k.toLowerCase())),
    );
    return hit?.id ?? "else";
  }

  private interpolate(text: string | undefined, vars: Vars): string {
    if (!text) return "";
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
  }

  /**
   * Plantilla aprobada por Meta: la única forma de escribirle a quien no nos
   * ha escrito (leads de formularios) o lleva más de 24 h callado. Si lleva
   * {{1}}, va el nombre del contacto; el resto de variables quedan vacías.
   */
  private async sendTemplate(conversationId: string, templateId?: string): Promise<void> {
    if (!templateId) return;
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      select: { body: true },
    });
    if (!template) {
      this.logger.warn(`Plantilla ${templateId} no existe: el flujo sigue sin enviarla`);
      return;
    }
    const body = /\{\{\s*1\s*\}\}/.test(template.body) ? [{ index: 1, source: "contact_name" as const }] : [];
    try {
      await this.messaging.sendTemplateMessage(
        { conversationId, templateId, fill: { body, urlButtons: [] } },
        MessageAuthor.AI,
      );
    } catch (e) {
      this.logger.warn(`No se pudo enviar la plantilla en ${conversationId}: ${(e as Error).message}`);
    }
  }

  private async send(conversationId: string, text: string): Promise<void> {
    if (!text.trim()) return;
    await this.messaging.queueOutbound(
      { conversationId, type: MessageType.TEXT, text },
      MessageAuthor.AI,
    );
  }

  private async persist(
    conversationId: string,
    currentNodeId: string | null,
    vars: Vars,
    status: string,
  ): Promise<void> {
    await this.prisma.flowSession.update({
      where: { conversationId },
      data: {
        currentNodeId,
        variables: vars as unknown as Prisma.InputJsonValue,
        status,
      },
    });
  }

  private async lastInboundText(conversationId: string): Promise<string> {
    const m = await this.prisma.message.findFirst({
      where: { conversationId, direction: "INBOUND" },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });
    return m?.content ?? "";
  }

  // ── Selección de flujo ──────────────────────────────────────
  private async findFlow(
    channelId: string | null,
    triggerType: FlowTriggerType,
    text?: string,
    pick?: (f: FlowRow) => boolean,
  ): Promise<FlowRow | null> {
    const rows = await this.prisma.flow.findMany({
      where: {
        isActive: true,
        triggerType,
        OR: [{ channelId }, { channelId: null }],
      },
      orderBy: { channelId: "desc" }, // prioriza el específico del canal
    });
    const flows = rows.map((r) => this.toRow(r));
    if (triggerType === "keyword") {
      const t = (text ?? "").toLowerCase();
      if (!t) return null;
      return (
        flows.find((f) =>
          f.triggerKeywords.some((k) => t.includes(k.toLowerCase())),
        ) ?? null
      );
    }
    if (pick) return flows.find(pick) ?? null;
    return flows[0] ?? null;
  }

  private async loadFlow(flowId: string): Promise<FlowRow | null> {
    const f = await this.prisma.flow.findUnique({ where: { id: flowId } });
    return f && f.isActive ? this.toRow(f) : null;
  }

  private toRow(f: {
    id: string;
    name: string;
    triggerType: string;
    triggerKeywords: string[];
    triggerConfig?: unknown;
    nodes: unknown;
    edges: unknown;
  }): FlowRow {
    return {
      id: f.id,
      name: f.name,
      triggerType: f.triggerType as FlowTriggerType,
      triggerKeywords: f.triggerKeywords,
      triggerConfig: parseTriggerConfig(f.triggerConfig),
      nodes: (f.nodes as FlowNode[] | null) ?? [],
      edges: (f.edges as FlowEdge[] | null) ?? [],
    };
  }
}

interface FlowRow {
  id: string;
  name: string;
  triggerType: FlowTriggerType;
  triggerKeywords: string[];
  triggerConfig: FlowTriggerConfig;
  nodes: FlowNode[];
  edges: FlowEdge[];
}
