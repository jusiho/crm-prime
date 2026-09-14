import { z } from "zod";
import { phoneField } from "./contact.schema.js";

// Payload de un lead recibido por webhook externo (landing, ads, n8n, Zapier…).
export const leadWebhookSchema = z.object({
  phone: phoneField,
  name: z.string().max(160).optional(),
  source: z.string().max(80).optional(), // nombre de la fuente (se crea si no existe)
  tags: z.array(z.string().max(60)).optional(),
  fields: z.record(z.string()).optional(), // campos personalizados (key → valor)
  optIn: z.boolean().optional(),
  // Qué integración envía el lead (n8n, Zapier, landing…). Solo informativo:
  // se guarda en Contact.originDetail para poder depurar de dónde vino.
  integration: z.string().max(80).optional(),
});
export type LeadWebhookInput = z.infer<typeof leadWebhookSchema>;
