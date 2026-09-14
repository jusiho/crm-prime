import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  AiSuggestion,
  Classification,
  PlaygroundReply,
  PlaygroundRequest,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { KnowledgeService } from "../knowledge/knowledge.service";
import { AgentActionsService } from "./agent-actions.service";
import { BotService } from "./bot.service";
import { LLM_PROVIDER, type LLMProvider } from "./llm.provider";
import type {
  LlmMessage,
  LlmToolResultBlock,
  LlmToolUseBlock,
} from "./llm.types";
import { isActionTool, resolveTools } from "./tools.registry";

// Precios por millón de tokens (para estimar costo).
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5, out: 25 },
};

@Injectable()
export class AgentService {
  private readonly logger = new Logger("Agent");

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeService,
    private readonly bots: BotService,
    private readonly actions: AgentActionsService,
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
  ) {}

  async suggest(conversationId: string): Promise<AiSuggestion> {
    const started = Date.now();
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });
    if (!conversation) throw new NotFoundException("Conversación no encontrada");

    const windowOpen =
      !!conversation.windowExpiresAt && conversation.windowExpiresAt > new Date();

    // Bot del canal por el que entró la conversación (o el bot por defecto).
    const config = await this.bots.resolveForChannel(conversation.channelId);

    const system = this.buildSystem(config?.systemPrompt, conversation.contact);
    const messages = await this.buildHistory(conversationId);
    // Las acciones necesitan los valores reales (etiquetas, etapas, vendedores)
    // para que el modelo elija de una lista cerrada en vez de inventarlos.
    const toolContext = await this.actions.loadContext();
    const tools = resolveTools(config?.enabledTools ?? [], toolContext);
    // En autopilot la IA aplica sus acciones sola; en copilot quedan
    // pendientes hasta que el humano envía la respuesta.
    const autoApply = conversation.aiMode === "AUTOPILOT";
    const maxIterations = config?.maxIterations ?? 6;
    const effort = config?.effort ?? "medium";

    // Clasificación previa del último mensaje del contacto.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastUserText =
      typeof lastUser?.content === "string" ? lastUser.content : "";
    const classification = await this.classifySafe(lastUserText);

    // RAG: si la tool search_knowledge está habilitada, recuperar fragmentos
    // relevantes de la base de conocimiento y fundamentar la respuesta.
    const ragEnabled = (config?.enabledTools ?? []).includes("search_knowledge");
    const knowledge =
      ragEnabled && lastUserText ? await this.retrieveSafe(lastUserText) : [];

    const run = await this.prisma.aiRun.create({
      data: {
        conversationId,
        agentConfigId: config?.id ?? null,
        status: "RUNNING",
        model: config?.model ?? "claude-opus-4-8",
      },
    });

    let suggestion: string | null = null;
    let escalate = false;
    let escalationReason: string | null = null;
    let status = "COMPLETED";
    let inputTokens = 0;
    let outputTokens = 0;
    let model = config?.model ?? "claude-opus-4-8";
    const toolsUsed: string[] = [];

    try {
      for (let i = 0; i < maxIterations; i++) {
        const res = await this.llm.generate({
          system,
          messages,
          tools: tools.length ? tools : undefined,
          knowledge: knowledge.length ? knowledge : undefined,
          effort,
          maxTokens: 1024,
          model: config?.model,
        });
        inputTokens += res.usage.inputTokens;
        outputTokens += res.usage.outputTokens;
        model = res.model;

        if (res.stopReason === "refusal") {
          escalate = true;
          escalationReason = "El modelo rechazó la solicitud (safety).";
          status = "REFUSED";
          break;
        }

        const toolUses = res.content.filter(
          (b): b is LlmToolUseBlock => b.type === "tool_use",
        );

        if (toolUses.length === 0) {
          suggestion = res.content
            .filter((b) => b.type === "text")
            .map((b) => (b as { text: string }).text)
            .join("")
            .trim();
          status = "COMPLETED";
          break;
        }

        // Añadir el turno del asistente con sus bloques (text + tool_use).
        messages.push({ role: "assistant", content: res.content });

        const results: LlmToolResultBlock[] = [];
        for (const tu of toolUses) {
          toolsUsed.push(tu.name);
          const { output, escalated, reason } = await this.runTool(
            run.id,
            conversation.contact,
            tu,
            autoApply,
            conversationId,
          );
          if (escalated) {
            escalate = true;
            escalationReason = reason ?? "Escalado por la IA.";
          }
          results.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: output,
          });
        }
        messages.push({ role: "user", content: results });

        if (i === maxIterations - 1 && !suggestion) {
          status = "ESCALATED";
          escalate = true;
          escalationReason =
            escalationReason ?? "Se alcanzó el máximo de iteraciones.";
        }
      }
    } catch (e) {
      this.logger.error(`Fallo del agente: ${(e as Error).message}`);
      status = "ERROR";
      escalate = true;
      escalationReason = "Error al generar la respuesta.";
    }

    // Guardrail: la clasificación puede forzar el escalado a humano.
    if (classification?.requiresHuman && !escalate) {
      escalate = true;
      escalationReason =
        escalationReason ?? "La conversación requiere atención humana.";
      if (status === "COMPLETED") status = "ESCALATED";
    }

    const costUsd = this.cost(model, inputTokens, outputTokens);
    await this.prisma.aiRun.update({
      where: { id: run.id },
      data: {
        status: status as
          | "COMPLETED"
          | "ESCALATED"
          | "REFUSED"
          | "ERROR"
          | "RUNNING",
        model,
        inputTokens,
        outputTokens,
        costUsd,
        classification: classification
          ? (classification as unknown as Prisma.InputJsonObject)
          : undefined,
        confidence: classification ? this.confidence(classification) : null,
        escalationReason,
        latencyMs: Date.now() - started,
      },
    });

    // Lo que quedó pendiente de aprobación (vacío en autopilot: ya se aplicó).
    const pendingActions = (await this.actions.pendingFor(run.id)).map((p) => ({
      ...p,
      applied: false,
    }));

    return {
      runId: run.id,
      suggestion,
      classification: classification ?? null,
      escalate,
      escalationReason,
      windowOpen,
      model,
      provider: this.llm.name,
      toolsUsed: [
        ...new Set([
          ...toolsUsed,
          ...(knowledge.length ? ["search_knowledge"] : []),
        ]),
      ],
      pendingActions,
    };
  }

  // ── Playground: probar el agente con texto libre, sin persistir ─
  // No crea conversación, ni AiRun, ni envía nada. Reutiliza la config del bot
  // (prompt, herramientas, modelo) para que el resultado sea fiel al real.
  async playground(input: PlaygroundRequest): Promise<PlaygroundReply> {
    const config = input.botId
      ? await this.prisma.agentConfig.findUnique({ where: { id: input.botId } })
      : await this.bots.resolveForChannel(null);

    const contact = { name: "Cliente de prueba", phone: "+000000000" };
    const system = this.buildSystem(config?.systemPrompt, contact);
    const toolContext = await this.actions.loadContext();
    const tools = resolveTools(config?.enabledTools ?? [], toolContext);
    // En el playground las acciones no se aplican: solo se listan.
    const simulatedActions: string[] = [];
    const maxIterations = config?.maxIterations ?? 6;
    const effort = config?.effort ?? "medium";

    const messages: LlmMessage[] = [
      ...input.history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: input.message },
    ];
    // La API exige que el primer mensaje sea del usuario.
    while (messages.length && messages[0]!.role === "assistant") messages.shift();

    const ragEnabled = (config?.enabledTools ?? []).includes("search_knowledge");
    const knowledge = ragEnabled ? await this.retrieveSafe(input.message) : [];

    let reply: string | null = null;
    let escalate = false;
    let escalationReason: string | null = null;
    let model = config?.model ?? "claude-opus-4-8";
    let inputTokens = 0;
    let outputTokens = 0;
    const toolsUsed: string[] = [];

    try {
      for (let i = 0; i < maxIterations; i++) {
        const res = await this.llm.generate({
          system,
          messages,
          tools: tools.length ? tools : undefined,
          knowledge: knowledge.length ? knowledge : undefined,
          effort,
          maxTokens: 1024,
          model: config?.model,
        });
        inputTokens += res.usage.inputTokens;
        outputTokens += res.usage.outputTokens;
        model = res.model;

        if (res.stopReason === "refusal") {
          escalate = true;
          escalationReason = "El modelo rechazó la solicitud (safety).";
          break;
        }

        const toolUses = res.content.filter(
          (b): b is LlmToolUseBlock => b.type === "tool_use",
        );

        if (toolUses.length === 0) {
          reply = res.content
            .filter((b) => b.type === "text")
            .map((b) => (b as { text: string }).text)
            .join("")
            .trim();
          break;
        }

        messages.push({ role: "assistant", content: res.content });
        const results: LlmToolResultBlock[] = [];
        for (const tu of toolUses) {
          toolsUsed.push(tu.name);
          const { output, escalated, reason } = await this.runTool(
            null,
            { ...contact, id: "playground", optIn: true, lastMessageAt: null },
            tu,
            false,
            null,
          );
          if (isActionTool(tu.name)) simulatedActions.push(output);
          if (escalated) {
            escalate = true;
            escalationReason = reason ?? "Escalado por la IA.";
          }
          results.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: output,
          });
        }
        messages.push({ role: "user", content: results });
      }
    } catch (e) {
      this.logger.error(`Fallo del playground: ${(e as Error).message}`);
      escalate = true;
      escalationReason = "Error al generar la respuesta.";
    }

    return {
      reply,
      simulatedActions,
      escalate,
      escalationReason,
      model,
      provider: this.llm.name,
      toolsUsed: [
        ...new Set([
          ...toolsUsed,
          ...(knowledge.length ? ["search_knowledge"] : []),
        ]),
      ],
      inputTokens,
      outputTokens,
      costUsd: this.cost(model, inputTokens, outputTokens),
    };
  }

  private async retrieveSafe(query: string): Promise<string[]> {
    try {
      return await this.knowledge.retrieve(query, 3);
    } catch (e) {
      this.logger.warn(`Recuperación RAG falló: ${(e as Error).message}`);
      return [];
    }
  }

  private async classifySafe(text: string): Promise<Classification | null> {
    if (!text.trim()) return null;
    try {
      return await this.llm.classify(text);
    } catch (e) {
      this.logger.warn(`Clasificación falló: ${(e as Error).message}`);
      return null;
    }
  }

  private confidence(c: Classification): number {
    // Heurística simple: menor confianza si requiere humano o es negativo.
    let v = 0.85;
    if (c.requiresHuman) v -= 0.3;
    if (c.sentiment === "negative") v -= 0.15;
    if (c.urgency === "high") v -= 0.1;
    return Math.max(0.1, Number(v.toFixed(2)));
  }

  // ── Herramientas ───────────────────────────────────────────────
  private async runTool(
    aiRunId: string | null,
    contact: {
      id: string;
      name: string | null;
      phone: string;
      optIn: boolean;
      lastMessageAt: Date | null;
    },
    tu: LlmToolUseBlock,
    autoApply: boolean,
    conversationId: string | null,
  ): Promise<{ output: string; escalated: boolean; reason?: string }> {
    let output = "";
    let escalated = false;
    let reason: string | undefined;

    // ── Acciones que escriben en el CRM ──────────────────────────
    if (isActionTool(tu.name)) {
      return this.runAction(aiRunId, contact.id, conversationId, tu, autoApply);
    }

    if (tu.name === "search_contact") {
      output = JSON.stringify({
        name: contact.name,
        phone: contact.phone,
        optIn: contact.optIn,
        lastMessageAt: contact.lastMessageAt?.toISOString() ?? null,
      });
    } else if (tu.name === "search_knowledge") {
      const hits = await this.knowledge.search(String(tu.input.query ?? ""), 4);
      output = JSON.stringify(
        hits.map((h) => ({ doc: h.docTitle, content: h.content })),
      );
    } else if (tu.name === "search_products") {
      // Etapa 1: el agente lee el catálogo. Si hay término, filtra; si no
      // encuentra nada (o no hay término), devuelve el catálogo completo para
      // que el agente tenga la información y no responda "no hay" por error.
      const q = String(tu.input.query ?? "").trim();
      const MAX = 50;
      const select = {
        id: true,
        name: true,
        price: true,
        currency: true,
        sku: true,
        description: true,
        imageUrl: true,
      } as const;
      const baseWhere = { isActive: true } as const;

      let rows = q
        ? await this.prisma.product.findMany({
            where: {
              ...baseWhere,
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { name: "asc" },
            take: MAX,
            select,
          })
        : [];

      // Sin término o sin coincidencias → catálogo completo (hasta MAX).
      let listedAll = false;
      if (rows.length === 0) {
        rows = await this.prisma.product.findMany({
          where: baseWhere,
          orderBy: { name: "asc" },
          take: MAX,
          select,
        });
        listedAll = true;
      }

      const total = await this.prisma.product.count({ where: baseWhere });
      const items = rows.map((p) => ({
        name: p.name,
        price: Number(p.price),
        currency: p.currency,
        sku: p.sku,
        description: p.description,
        // Se expone solo si TIENE foto, no la URL: así el modelo sabe que
        // puede mandarla (con send_product_image) pero no puede inventarse
        // ni filtrar un enlace.
        hasImage: !!p.imageUrl,
      }));
      output = JSON.stringify({
        // Nota para el agente: si filtró y no hubo match, le devolvemos todo.
        note:
          total === 0
            ? "El catálogo está vacío."
            : q && listedAll
              ? `Sin coincidencias exactas para "${q}"; se lista el catálogo completo.`
              : listedAll
                ? "Catálogo completo."
                : `Resultados para "${q}".`,
        total,
        truncated: total > MAX,
        products: items,
      });
    } else if (tu.name === "handoff_to_human") {
      reason = String(tu.input.reason ?? "Escalado solicitado por la IA.");
      escalated = true;
      output = "Se registró el escalado a un agente humano.";
    } else {
      output = `Herramienta desconocida: ${tu.name}`;
    }

    // En el playground (aiRunId null) no se persiste la llamada a la tool.
    if (aiRunId) {
      await this.prisma.aiToolCall.create({
        data: {
          aiRunId,
          toolName: tu.name,
          input: tu.input as Prisma.InputJsonObject,
          output: { result: output },
          status: "EXECUTED",
          resolvedAt: new Date(),
        },
      });
    }

    return { output, escalated, reason };
  }

  /**
   * Ejecuta (o aparca) una acción sobre el CRM y le devuelve al modelo un
   * tool_result honesto: si queda pendiente de aprobación, se lo decimos,
   * para que no le prometa al cliente algo que aún no ha pasado.
   */
  private async runAction(
    aiRunId: string | null,
    contactId: string,
    conversationId: string | null,
    tu: LlmToolUseBlock,
    autoApply: boolean,
  ): Promise<{ output: string; escalated: boolean; reason?: string }> {
    const summary = this.actions.summarize(tu.name, tu.input);

    // Playground: nada toca la BD, solo se describe lo que haría.
    if (!aiRunId) {
      return {
        output: `(simulado, no se aplicó) ${summary}`,
        escalated: false,
      };
    }

    if (!autoApply) {
      await this.actions.record(
        aiRunId,
        tu.name,
        tu.input,
        "PENDING_APPROVAL",
        summary,
      );
      return {
        output: `Acción registrada: ${summary}. Queda PENDIENTE hasta que el agente humano apruebe la respuesta; todavía no se ha aplicado.`,
        escalated: false,
      };
    }

    try {
      const result = await this.actions.execute(
        tu.name,
        tu.input,
        contactId,
        conversationId,
      );
      await this.actions.record(aiRunId, tu.name, tu.input, "EXECUTED", result);
      return { output: result, escalated: false };
    } catch (e) {
      const message = (e as Error).message;
      this.logger.warn(`Acción ${tu.name} falló: ${message}`);
      await this.actions.record(aiRunId, tu.name, tu.input, "ERROR", message);
      return { output: `No se pudo aplicar: ${message}`, escalated: false };
    }
  }

  // ── Construcción del contexto ──────────────────────────────────
  private buildSystem(
    base: string | undefined,
    contact: { name: string | null; phone: string },
  ): string {
    const fallback =
      "Eres un asistente de atención al cliente por WhatsApp. Responde en español, breve y cordial. Redacta una posible respuesta para que un agente humano la revise antes de enviarla. Si no estás seguro o el caso lo amerita, usa la herramienta handoff_to_human.";
    return [
      base ?? fallback,
      `\n\nContacto actual: ${contact.name ?? "(sin nombre)"} (${contact.phone}).`,
      "Devuelve únicamente el texto de la respuesta sugerida, sin prefijos como 'Respuesta:'.",
    ].join("");
  }

  private async buildHistory(conversationId: string): Promise<LlmMessage[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 40,
    });
    const msgs: LlmMessage[] = rows.map((m) => ({
      role: m.direction === "INBOUND" ? "user" : "assistant",
      content: m.content ?? `[${m.type.toLowerCase()}]`,
    }));
    // La API exige que el primer mensaje sea del usuario.
    while (msgs.length && msgs[0]!.role === "assistant") msgs.shift();
    if (msgs.length === 0) {
      msgs.push({ role: "user", content: "(el contacto inició la conversación)" });
    }
    return msgs;
  }

  private cost(model: string, input: number, output: number): number {
    const p = PRICES[model];
    if (!p) return 0;
    return (input / 1e6) * p.in + (output / 1e6) * p.out;
  }
}
