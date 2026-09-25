import { z } from "zod";

// ── DTOs de salida ──────────────────────────────────────────
export const stageDtoSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  name: z.string(),
  order: z.number(),
  isWon: z.boolean(),
  isLost: z.boolean(),
});
export type StageDto = z.infer<typeof stageDtoSchema>;

// Etapa con el nombre de su embudo: para selectores que cruzan embudos
// (flujos, agente).
export const stageRefSchema = stageDtoSchema.extend({ pipelineName: z.string() });
export type StageRef = z.infer<typeof stageRefSchema>;

// Un embudo. Puede haber varios por empresa; uno es el predeterminado.
export const pipelineSummaryDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  isDefault: z.boolean(),
  // Entrada automática de WhatsApp: crear una oportunidad al primer mensaje
  // de un contacto sin ninguna en curso, en `inboundStageId` (o la primera).
  inboundEnabled: z.boolean(),
  inboundStageId: z.string().nullable(),
  inboundDiscardDays: z.number(), // 0 = no descartar sola
  // Números de WhatsApp cuyas conversaciones entran a este embudo. Los que
  // no están en ningún embudo entran al predeterminado.
  channelIds: z.array(z.string()),
  stageCount: z.number(),
  openDeals: z.number(),
});
export type PipelineSummaryDto = z.infer<typeof pipelineSummaryDtoSchema>;

export const dealDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  value: z.number().nullable(),
  currency: z.string(),
  stageId: z.string(),
  pipelineId: z.string(),
  contact: z.object({
    id: z.string(),
    name: z.string().nullable(),
    phone: z.string(),
    fields: z.record(z.string()).default({}), // campos personalizados del lead
  }),
  // Fuente del contacto (WhatsApp, Anuncio de Meta, Referido…), para verla en la tarjeta.
  source: z
    .object({ id: z.string(), name: z.string(), color: z.string().nullable() })
    .nullable(),
  owner: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  // Descartada: no era venta, o nadie la atendió a tiempo ("auto").
  discardedAt: z.string().nullable(),
  discardReason: z.string().nullable(),
  createdAt: z.string(),
});
export type DealDto = z.infer<typeof dealDtoSchema>;

export const pipelineViews = ["open", "discarded"] as const;
export type PipelineView = (typeof pipelineViews)[number];

// El tablero de un embudo: sus etapas y oportunidades, más la lista de
// embudos (para cambiar de uno a otro) y todas las etapas (para selectores).
export const pipelineDtoSchema = z.object({
  pipelineId: z.string(),
  pipelines: z.array(pipelineSummaryDtoSchema),
  stages: z.array(stageDtoSchema),
  stagesAll: z.array(stageRefSchema),
  deals: z.array(dealDtoSchema),
  view: z.enum(pipelineViews),
  discardedCount: z.number(),
});
export type PipelineDto = z.infer<typeof pipelineDtoSchema>;

// ── Entradas: oportunidades ─────────────────────────────────
export const createDealSchema = z.object({
  contactId: z.string(),
  title: z.string().min(1).max(160),
  value: z.number().nonnegative().optional(),
  currency: z.string().length(3).default("USD"),
  stageId: z.string().optional(), // por defecto, la primera etapa del embudo
  pipelineId: z.string().optional(), // por defecto, el embudo predeterminado
});
export type CreateDealInput = z.infer<typeof createDealSchema>;

export const updateDealSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  value: z.number().nonnegative().nullable().optional(),
  ownerId: z.string().nullable().optional(),
});
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

export const moveDealSchema = z.object({
  stageId: z.string(),
});
export type MoveDealInput = z.infer<typeof moveDealSchema>;

export const discardDealSchema = z.object({
  reason: z.string().max(200).optional(),
});
export type DiscardDealInput = z.infer<typeof discardDealSchema>;

// ── Entradas: embudos ───────────────────────────────────────
export const createPipelineSchema = z.object({
  name: z.string().min(1).max(60),
  makeDefault: z.boolean().optional(),
});
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;

export const updatePipelineSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  // Solo se puede poner a true: el predeterminado se cambia eligiendo otro.
  isDefault: z.boolean().optional(),
  inboundEnabled: z.boolean().optional(),
  inboundStageId: z.string().nullable().optional(),
  inboundDiscardDays: z.number().int().min(0).max(365).optional(),
  channelIds: z.array(z.string()).optional(),
});
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>;

export const reorderPipelinesSchema = z.object({
  ids: z.array(z.string()).min(1),
});
export type ReorderPipelinesInput = z.infer<typeof reorderPipelinesSchema>;

// ── Etapas (columnas configurables) ─────────────────────────
export const createStageSchema = z.object({
  name: z.string().min(1).max(60),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
  pipelineId: z.string().optional(), // por defecto, el embudo predeterminado
});
export type CreateStageInput = z.infer<typeof createStageSchema>;

export const updateStageSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
});
export type UpdateStageInput = z.infer<typeof updateStageSchema>;

export const reorderStagesSchema = z.object({
  ids: z.array(z.string()).min(1),
});
export type ReorderStagesInput = z.infer<typeof reorderStagesSchema>;

// ── Contacto (para el selector al crear un deal) ────────────
export const contactDtoSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  phone: z.string(),
});
export type ContactDto = z.infer<typeof contactDtoSchema>;
