import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  flowEdgeSchema,
  flowNodeSchema,
  type FlowAssistantReply,
  type FlowAssistantRequest,
  type FlowEdge,
  type FlowNode,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { LLM_PROVIDER, type LLMProvider } from "./llm.provider";

// Espaciado del auto-layout (las posiciones que devuelve el modelo se ignoran).
const COL_W = 320;
const ROW_H = 170;

interface Catalog {
  bots: { id: string; name: string }[];
  stages: { id: string; name: string }[];
  agents: { id: string; name: string }[];
  tags: string[];
  flows: { id: string; name: string }[];
}

/**
 * Asistente del constructor de flujos: traduce una instrucción en lenguaje
 * natural a un grafo de bloques (los mismos tipos que la paleta) y también
 * edita el grafo que ya está en el lienzo.
 *
 * El modelo solo propone; nada se guarda. La respuesta se valida contra los
 * esquemas de flujo y contra los ids reales del workspace (bots, etapas,
 * agentes, etiquetas, flujos): lo que no cuadra se corrige o se avisa.
 */
@Injectable()
export class FlowAssistantService {
  private readonly logger = new Logger("FlowAssistant");

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
  ) {}

  async run(input: FlowAssistantRequest): Promise<FlowAssistantReply> {
    const catalog = await this.loadCatalog(input.flowId);
    const system = this.buildSystem(catalog);

    const messages = [
      ...input.history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: this.buildUserTurn(input) },
    ];
    while (messages.length && messages[0]!.role === "assistant") messages.shift();

    let raw = "";
    let model = "—";
    try {
      const res = await this.llm.generate({
        system,
        messages,
        effort: "high",
        maxTokens: 8000,
      });
      model = res.model;
      raw = res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("")
        .trim();
    } catch (e) {
      this.logger.error(`Fallo del asistente: ${(e as Error).message}`);
      return {
        message: `No pude generar el flujo: ${(e as Error).message}`,
        nodes: null,
        edges: null,
        warnings: [],
        model,
        provider: this.llm.name,
      };
    }

    const parsed = this.parseJson(raw);
    if (!parsed) {
      return {
        message:
          raw.slice(0, 800) ||
          "El modelo no devolvió una respuesta utilizable. Intenta describir el flujo con más detalle.",
        nodes: null,
        edges: null,
        warnings: ["La respuesta no traía un JSON válido; no se cambió nada."],
        model,
        provider: this.llm.name,
      };
    }

    const message =
      typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message.trim()
        : "Listo.";

    // El modelo puede limitarse a responder una duda, sin tocar el lienzo.
    if (!Array.isArray(parsed.nodes)) {
      return {
        message,
        nodes: null,
        edges: null,
        warnings: [],
        model,
        provider: this.llm.name,
      };
    }

    const { nodes, edges, warnings } = this.normalize(
      parsed.nodes,
      Array.isArray(parsed.edges) ? parsed.edges : [],
      catalog,
    );

    return { message, nodes, edges, warnings, model, provider: this.llm.name };
  }

  // ── Contexto real del workspace ─────────────────────────────
  private async loadCatalog(flowId: string | null): Promise<Catalog> {
    const [bots, stages, agents, tags, flows] = await Promise.all([
      this.prisma.agentConfig.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.pipelineStage.findMany({
        select: { id: true, name: true },
        orderBy: { order: "asc" },
      }),
      this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.tag.findMany({
        select: { name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.flow.findMany({
        where: flowId ? { id: { not: flowId } } : {},
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
    ]);

    return {
      bots,
      stages,
      agents: agents.map((a) => ({ id: a.id, name: a.name ?? a.email })),
      tags: tags.map((t) => t.name),
      flows,
    };
  }

  // ── Prompt ──────────────────────────────────────────────────
  private buildSystem(c: Catalog): string {
    const list = (items: { id: string; name: string }[]) =>
      items.length
        ? items.map((i) => `  - ${i.name} → id "${i.id}"`).join("\n")
        : "  (ninguno disponible)";

    return `Eres el asistente del constructor de flujos de un CRM de WhatsApp.
Diseñas automatizaciones conversacionales combinando SOLO los bloques del catálogo.
Escribes siempre en español, con textos de mensaje cortos y naturales para WhatsApp.

## Catálogo de bloques (campo "type" del nodo)
- "start": el único punto de entrada. Debe existir exactamente uno, con id "start" y data {}.
- "sendMessage": envía un mensaje. data: { "text": "..." }. Una salida.
- "askQuestion": envía una pregunta y ESPERA la respuesta del contacto, guardándola
  en una variable. data: { "text": "...", "variable": "nombre_snake_case" }. Una salida.
- "condition": ramifica según el último mensaje del contacto.
  data: { "branches": [ { "id": "b1", "label": "Precio", "keywords": ["precio","costo"] } ] }.
  Cada rama es una salida cuyo sourceHandle es el id de la rama. Existe además la
  salida "else" (obligatoria conectarla si quieres cubrir el resto de casos).
- "action": ejecuta una acción. data.action puede ser:
    "ai"        → pasa la conversación a un bot de IA. data: { "action":"ai", "botId":"<id o null>" }
    "handoff"   → pasa a un humano y DETIENE el flujo (no conectes nada después)
    "tag"       → pone una etiqueta. data: { "action":"tag", "tag":"<nombre>" }
    "move_deal" → mueve la oportunidad de etapa. data: { "action":"move_deal", "stageId":"<id>" }
  Una salida (salvo "handoff", que termina).
- "delay": pausa antes de seguir. data: { "delayValue": 10, "delayUnit": "minutes"|"hours" }. Una salida.
- "http": llama a una API externa.
  data: { "method":"POST", "url":"https://…", "headers":"{\\"Authorization\\":\\"...\\"}",
          "httpBody":"{...}", "saveAs":"variable_respuesta" }. Una salida.
- "assign": asigna la conversación a un agente humano. data: { "agentId":"<id>", "agentName":"<nombre>" }. Una salida.
- "jumpToFlow": continúa en otro flujo. data: { "flowId":"<id>", "flowName":"<nombre>" }. SIN salida (es terminal).

## Reglas duras
1. Cada salida admite como máximo UNA arista. Para bifurcar usa "condition".
2. Las aristas son { "id", "source", "target", "sourceHandle" }. sourceHandle es null
   salvo en "condition", donde vale el id de la rama o "else".
3. Los ids de nodo son cortos y únicos (n1, n2, …); el de inicio siempre es "start".
4. En los textos puedes interpolar variables capturadas antes con {{nombre_variable}}.
   Nunca uses una variable que no haya guardado un "askQuestion" previo.
5. Usa SOLO ids reales del catálogo de abajo. Si necesitas un bot/etapa/agente/flujo
   que no existe, no lo inventes: deja el campo en null y explícalo en "message".
6. No dejes bloques sueltos: todo nodo debe ser alcanzable desde "start".
7. Omite el campo "position": el lienzo coloca los bloques automáticamente.

## Recursos reales de este workspace
Bots de IA:
${list(c.bots)}
Etapas del pipeline:
${list(c.stages)}
Agentes humanos:
${list(c.agents)}
Otros flujos (para "jumpToFlow"):
${list(c.flows)}
Etiquetas existentes: ${c.tags.length ? c.tags.map((t) => `"${t}"`).join(", ") : "(ninguna)"}

## Formato de salida
Responde ÚNICAMENTE con un objeto JSON, sin texto alrededor ni vallas de código:
{
  "message": "explicación breve, en español, de lo que hiciste o preguntas si te falta info",
  "nodes": [ { "id": "...", "type": "...", "data": { ... } } ],
  "edges": [ { "id": "...", "source": "...", "target": "...", "sourceHandle": null } ]
}
Si el usuario solo pregunta algo y no hay que tocar el lienzo, omite "nodes" y "edges".
Cuando te pidan un ajuste sobre un flujo existente, devuelve SIEMPRE el grafo COMPLETO
resultante (no solo el trozo modificado).`;
  }

  private buildUserTurn(input: FlowAssistantRequest): string {
    if (!input.nodes.length || (input.nodes.length === 1 && input.nodes[0]?.type === "start")) {
      return `El lienzo está vacío. Crea el flujo desde cero.\n\nPetición: ${input.prompt}`;
    }
    return `Flujo actual en el lienzo (modifícalo y devuélvelo completo):
\`\`\`json
${JSON.stringify(
  {
    nodes: input.nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
    edges: input.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
    })),
  },
  null,
  1,
)}
\`\`\`

Petición: ${input.prompt}`;
  }

  // ── Parseo tolerante ────────────────────────────────────────
  // Los modelos a veces envuelven el JSON en ```json o le añaden prosa.
  private parseJson(raw: string): Record<string, unknown> | null {
    const candidates: string[] = [];
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced?.[1]) candidates.push(fenced[1]);
    candidates.push(raw);
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first !== -1 && last > first) candidates.push(raw.slice(first, last + 1));

    for (const c of candidates) {
      try {
        const parsed = JSON.parse(c.trim()) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // siguiente candidato
      }
    }
    return null;
  }

  // ── Validación + saneado + auto-layout ──────────────────────
  private normalize(
    rawNodes: unknown[],
    rawEdges: unknown[],
    catalog: Catalog,
  ): { nodes: FlowNode[]; edges: FlowEdge[]; warnings: string[] } {
    const warnings: string[] = [];
    const nodes: FlowNode[] = [];
    const seen = new Set<string>();

    for (const candidate of rawNodes) {
      const withPos = {
        position: { x: 0, y: 0 },
        data: {},
        ...(candidate as Record<string, unknown>),
      };
      const parsed = flowNodeSchema.safeParse(withPos);
      if (!parsed.success) {
        warnings.push(
          `Se descartó un bloque inválido: ${JSON.stringify(candidate).slice(0, 90)}…`,
        );
        continue;
      }
      if (seen.has(parsed.data.id)) {
        warnings.push(`Se descartó un bloque con id repetido "${parsed.data.id}".`);
        continue;
      }
      seen.add(parsed.data.id);
      nodes.push(this.sanitizeNode(parsed.data, catalog, warnings));
    }

    // Debe haber exactamente un "start", y es el ancla del layout.
    const starts = nodes.filter((n) => n.type === "start");
    if (starts.length === 0) {
      nodes.unshift({
        id: "start",
        type: "start",
        position: { x: 0, y: 0 },
        data: {},
      });
      seen.add("start");
      const firstOther = nodes.find((n) => n.type !== "start");
      if (firstOther) {
        rawEdges.push({
          id: `e-start-${firstOther.id}`,
          source: "start",
          target: firstOther.id,
          sourceHandle: null,
        });
      }
      warnings.push("Faltaba el bloque de inicio; se añadió automáticamente.");
    } else if (starts.length > 1) {
      for (const extra of starts.slice(1)) {
        const i = nodes.indexOf(extra);
        if (i >= 0) nodes.splice(i, 1);
        seen.delete(extra.id);
      }
      warnings.push("Había varios bloques de inicio; se conservó solo el primero.");
    }

    // Aristas: solo entre nodos existentes, con un sourceHandle que exista de
    // verdad en el nodo origen y una sola arista por salida.
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const edges: FlowEdge[] = [];
    const takenOutputs = new Set<string>();
    for (const candidate of rawEdges) {
      const parsed = flowEdgeSchema.safeParse(candidate);
      if (!parsed.success) continue;
      const e = parsed.data;
      const source = byId.get(e.source);
      if (!source || !seen.has(e.target)) {
        warnings.push(
          `Se descartó una conexión hacia un bloque inexistente (${e.source} → ${e.target}).`,
        );
        continue;
      }
      if (source.type === "jumpToFlow") {
        warnings.push(
          `"Ir a otro flujo" es un bloque final: se descartó su conexión de salida.`,
        );
        continue;
      }

      // Solo "condition" tiene salidas con nombre (una por rama, más "else").
      let handle: string | null = e.sourceHandle ?? null;
      if (source.type === "condition") {
        const valid = new Set([
          ...(source.data.branches ?? []).map((b) => b.id),
          "else",
        ]);
        if (!handle || !valid.has(handle)) {
          warnings.push(
            `La condición "${e.source}" tenía una salida "${handle ?? "por defecto"}" que no existe; se descartó esa conexión.`,
          );
          continue;
        }
      } else if (handle) {
        // El modelo inventó una rama en un bloque de salida única: se ignora.
        handle = null;
      }

      const outKey = `${e.source}::${handle ?? ""}`;
      if (takenOutputs.has(outKey)) {
        warnings.push(
          `El bloque "${e.source}" tenía dos salidas por el mismo punto; se conservó la primera.`,
        );
        continue;
      }
      takenOutputs.add(outKey);
      edges.push({
        id: e.id || `e-${e.source}-${e.target}-${handle ?? ""}`,
        source: e.source,
        target: e.target,
        sourceHandle: handle,
        label: handle ?? undefined,
      });
    }

    this.layout(nodes, edges);

    const reachable = this.reachableFrom(nodes, edges, "start");
    const orphans = nodes.filter((n) => !reachable.has(n.id));
    if (orphans.length) {
      warnings.push(
        `${orphans.length} bloque(s) quedaron sin conectar al inicio: ${orphans
          .map((n) => n.id)
          .join(", ")}.`,
      );
    }

    return { nodes, edges, warnings };
  }

  // Sustituye referencias inventadas por null y rellena los nombres visibles.
  private sanitizeNode(
    node: FlowNode,
    catalog: Catalog,
    warnings: string[],
  ): FlowNode {
    const data = { ...node.data };

    if (node.type === "action" && data.action === "ai" && data.botId) {
      if (!catalog.bots.some((b) => b.id === data.botId)) {
        warnings.push(
          `El bloque "${node.id}" apuntaba a un bot inexistente; se dejó el bot por defecto.`,
        );
        data.botId = null;
      }
    }

    if (node.type === "action" && data.action === "move_deal" && data.stageId) {
      if (!catalog.stages.some((s) => s.id === data.stageId)) {
        warnings.push(
          `El bloque "${node.id}" apuntaba a una etapa inexistente; elígela a mano.`,
        );
        delete data.stageId;
      }
    }

    if (node.type === "assign") {
      const agent = catalog.agents.find((a) => a.id === data.agentId);
      if (data.agentId && !agent) {
        warnings.push(
          `El bloque "${node.id}" apuntaba a un agente inexistente; elígelo a mano.`,
        );
        data.agentId = null;
        delete data.agentName;
      } else if (agent) {
        data.agentName = agent.name;
      }
    }

    if (node.type === "jumpToFlow") {
      const target = catalog.flows.find((f) => f.id === data.flowId);
      if (data.flowId && !target) {
        warnings.push(
          `El bloque "${node.id}" saltaba a un flujo inexistente; elígelo a mano.`,
        );
        delete data.flowId;
        delete data.flowName;
      } else if (target) {
        data.flowName = target.name;
      }
    }

    // Las ramas de una condición necesitan id único dentro del nodo.
    if (node.type === "condition" && data.branches?.length) {
      data.branches = data.branches.map((b, i) => ({
        id: b.id?.trim() || `b${i + 1}`,
        label: b.label ?? "",
        keywords: b.keywords ?? [],
      }));
    }

    return { ...node, data };
  }

  // Layout en árbol: profundidad hacia abajo, hermanos hacia la derecha.
  private layout(nodes: FlowNode[], edges: FlowEdge[]): void {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const children = new Map<string, string[]>();
    for (const e of edges) {
      if (!children.has(e.source)) children.set(e.source, []);
      children.get(e.source)!.push(e.target);
    }

    const placed = new Set<string>();
    let nextColumn = 0;

    const walk = (id: string, depth: number): number => {
      const node = byId.get(id);
      if (!node || placed.has(id)) return nextColumn;
      placed.add(id);

      const kids = (children.get(id) ?? []).filter(
        (k) => byId.has(k) && !placed.has(k),
      );
      if (kids.length === 0) {
        const col = nextColumn++;
        node.position = { x: col * COL_W, y: depth * ROW_H };
        return col;
      }
      const cols = kids.map((k) => walk(k, depth + 1));
      const center = (Math.min(...cols) + Math.max(...cols)) / 2;
      node.position = { x: center * COL_W, y: depth * ROW_H };
      return center;
    };

    walk("start", 0);
    // Bloques sueltos: en una columna aparte a la derecha, para que se vean.
    for (const n of nodes) {
      if (placed.has(n.id)) continue;
      n.position = { x: (nextColumn + 1) * COL_W, y: placed.size * 60 };
      placed.add(n.id);
    }
  }

  private reachableFrom(
    nodes: FlowNode[],
    edges: FlowEdge[],
    rootId: string,
  ): Set<string> {
    const out = new Map<string, string[]>();
    for (const e of edges) {
      if (!out.has(e.source)) out.set(e.source, []);
      out.get(e.source)!.push(e.target);
    }
    const seen = new Set<string>();
    const queue = nodes.some((n) => n.id === rootId) ? [rootId] : [];
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(...(out.get(id) ?? []));
    }
    return seen;
  }
}
