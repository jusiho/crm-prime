import { z } from "zod";
import { phoneField } from "./contact.schema.js";

/**
 * Contrato de la API pública (`/api/public/v1`).
 *
 * Deliberadamente separado de los DTO internos: lo que consume un n8n o un ERP
 * ajeno no debe romperse porque cambie una pantalla del CRM. Estos esquemas se
 * versionan con la ruta y solo crecen de forma compatible.
 */

// ── Paginación por cursor ────────────────────────────────────
// Cursor y no offset: el listado se ordena por fecha y crece por arriba, así
// que un offset se desplaza y repite o salta registros entre páginas.
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    /** Pásalo como `cursor` para la siguiente página. Null = no hay más. */
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
}

// ── Contactos ────────────────────────────────────────────────
export const publicContactSchema = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string().nullable(),
  optIn: z.boolean(),
  tags: z.array(z.string()),
  source: z.string().nullable(),
  origin: z.string(),
  fields: z.record(z.string()),
  utm: z.record(z.string()),
  createdAt: z.string(),
  lastMessageAt: z.string().nullable(),
});
export type PublicContact = z.infer<typeof publicContactSchema>;

export const listContactsQuerySchema = pageQuerySchema.extend({
  search: z.string().max(120).optional(),
  tag: z.string().max(60).optional(),
  /** ISO 8601: solo contactos creados a partir de esta fecha. */
  createdSince: z.string().datetime().optional(),
});
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;

export const createPublicContactSchema = z.object({
  phone: phoneField,
  name: z.string().max(160).optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  source: z.string().max(80).optional(),
  fields: z.record(z.string().max(500)).optional(),
  optIn: z.boolean().optional(),
});
export type CreatePublicContactInput = z.infer<typeof createPublicContactSchema>;

export const updatePublicContactSchema = z.object({
  name: z.string().max(160).nullable().optional(),
  optIn: z.boolean().optional(),
  fields: z.record(z.string().max(500)).optional(),
  /** Reemplaza el juego de etiquetas. Omitir para no tocarlas. */
  tags: z.array(z.string().max(60)).max(20).optional(),
});
export type UpdatePublicContactInput = z.infer<typeof updatePublicContactSchema>;

// ── Oportunidades ────────────────────────────────────────────
export const publicDealSchema = z.object({
  id: z.string(),
  title: z.string(),
  stage: z.string(),
  value: z.number().nullable(),
  currency: z.string(),
  contactId: z.string(),
  contactPhone: z.string(),
  owner: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PublicDeal = z.infer<typeof publicDealSchema>;

export const createPublicDealSchema = z.object({
  /** Teléfono del contacto; se crea si no existe. */
  phone: phoneField,
  title: z.string().min(1).max(160),
  stage: z.string().max(80).optional(),
  value: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
});
export type CreatePublicDealInput = z.infer<typeof createPublicDealSchema>;

// Prefijo "public" para no chocar con el esquema interno del pipeline, que
// mueve por stageId; aquí se mueve por NOMBRE de etapa, que es lo que un
// sistema externo conoce.
export const movePublicDealSchema = z.object({
  stage: z.string().min(1).max(80),
});
export type MovePublicDealInput = z.infer<typeof movePublicDealSchema>;

// ── Mensajes ─────────────────────────────────────────────────
export const sendPublicMessageSchema = z.object({
  phone: phoneField,
  text: z.string().min(1).max(4096),
});
export type SendPublicMessageInput = z.infer<typeof sendPublicMessageSchema>;

export const sendPublicMessageResultSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  status: z.string(),
});
export type SendPublicMessageResult = z.infer<
  typeof sendPublicMessageResultSchema
>;

// ── Métricas (BI) ────────────────────────────────────────────
export const statsQuerySchema = z.object({
  /** Ventana en días hacia atrás. Por defecto 30. */
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export type StatsQuery = z.infer<typeof statsQuerySchema>;

export const statsSummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  contacts: z.object({ total: z.number(), nuevos: z.number() }),
  conversations: z.object({
    total: z.number(),
    abiertas: z.number(),
    pendientes: z.number(),
  }),
  messages: z.object({ entrantes: z.number(), salientes: z.number() }),
  ai: z.object({
    runs: z.number(),
    escalados: z.number(),
    tokens: z.number(),
    costeUsd: z.number(),
  }),
});
export type StatsSummary = z.infer<typeof statsSummarySchema>;

export const funnelStageSchema = z.object({
  stage: z.string(),
  order: z.number(),
  deals: z.number(),
  value: z.number(),
});
export type FunnelStage = z.infer<typeof funnelStageSchema>;

export const sellerStatsSchema = z.object({
  seller: z.string(),
  deals: z.number(),
  value: z.number(),
  ganados: z.number(),
});
export type SellerStats = z.infer<typeof sellerStatsSchema>;
