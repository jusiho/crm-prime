import { z } from "zod";
import { flowEdgeSchema, flowNodeSchema } from "./flow.schema.js";

// ── Asistente del constructor de flujos ──────────────────────
// Convierte una descripción en lenguaje natural en un grafo de bloques
// (los mismos tipos que la paleta) y también edita el grafo ya dibujado.

export const flowAssistantTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type FlowAssistantTurn = z.infer<typeof flowAssistantTurnSchema>;

export const flowAssistantRequestSchema = z.object({
  prompt: z.string().min(3).max(2000),
  // Grafo actual del lienzo: si trae bloques, la IA edita en lugar de crear.
  nodes: z.array(flowNodeSchema).max(120).default([]),
  edges: z.array(flowEdgeSchema).max(200).default([]),
  // Turnos previos del chat del asistente (para pedir ajustes encadenados).
  history: z.array(flowAssistantTurnSchema).max(20).default([]),
  // Flujo que se está editando: se excluye de los destinos de "jumpToFlow".
  flowId: z.string().nullable().default(null),
});
export type FlowAssistantRequest = z.infer<typeof flowAssistantRequestSchema>;

export const flowAssistantReplySchema = z.object({
  // Explicación breve de lo que hizo (o pregunta si le falta información).
  message: z.string(),
  // null = solo respondió, no propone cambios en el lienzo.
  nodes: z.array(flowNodeSchema).nullable(),
  edges: z.array(flowEdgeSchema).nullable(),
  // Avisos del validador: referencias inventadas, bloques sueltos, etc.
  warnings: z.array(z.string()),
  model: z.string(),
  provider: z.string(),
});
export type FlowAssistantReply = z.infer<typeof flowAssistantReplySchema>;
