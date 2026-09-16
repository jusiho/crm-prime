import { z } from "zod";
import { templateDtoSchema, templateFillSchema } from "./template.schema.js";

// ── Campañas ─────────────────────────────────────────────────
export const campaignStatuses = [
  "DRAFT",
  "SCHEDULED",
  "RUNNING",
  "COMPLETED",
  "CANCELLED",
] as const;
export type CampaignStatusValue = (typeof campaignStatuses)[number];

export const campaignChannelRefSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  displayPhoneNumber: z.string().nullable(),
});
export type CampaignChannelRef = z.infer<typeof campaignChannelRefSchema>;

export const campaignDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(campaignStatuses),
  template: z.object({ id: z.string(), name: z.string() }),
  channel: campaignChannelRefSchema.nullable(),
  tagIds: z.array(z.string()),
  fill: templateFillSchema,
  scheduledAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  totalRecipients: z.number(),
  sentCount: z.number(),
  deliveredCount: z.number(),
  readCount: z.number(),
  failedCount: z.number(),
  createdAt: z.string(),
});
export type CampaignDto = z.infer<typeof campaignDtoSchema>;

// Etiqueta de audiencia (con conteo de contactos con opt-in).
export const audienceTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  contactCount: z.number(),
});
export type AudienceTag = z.infer<typeof audienceTagSchema>;

// Datos para el asistente de creación (plantillas, etiquetas, canales).
export const campaignMetaSchema = z.object({
  templates: z.array(templateDtoSchema),
  tags: z.array(audienceTagSchema),
  channels: z.array(campaignChannelRefSchema),
});
export type CampaignMeta = z.infer<typeof campaignMetaSchema>;

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  templateId: z.string().min(1),
  channelId: z.string().nullable().default(null),
  tagIds: z.array(z.string()).default([]),
  fill: templateFillSchema.default({ body: [], urlButtons: [] }),
  scheduledAt: z.string().datetime().nullable().default(null),
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  templateId: z.string().min(1).optional(),
  channelId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  fill: templateFillSchema.optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

// Vista previa de audiencia (cuántos contactos recibirán).
export const audiencePreviewSchema = z.object({ count: z.number() });
export type AudiencePreview = z.infer<typeof audiencePreviewSchema>;
