import { z } from "zod";
import { apiKeyStateSchema } from "./ai-settings.schema.js";

/**
 * Credenciales que el CRM CONSUME para llamar a terceros y que hasta ahora
 * solo vivían en el .env. Mismo patrón que los ajustes de IA: se guardan
 * cifradas en la BD y, si están vacías, se usa la variable de entorno.
 *
 * El token de WhatsApp por número NO está aquí: vive en cada canal
 * (WhatsappConnection.accessToken, pestaña Canales). Aquí solo lo que es
 * a nivel de aplicación de Meta.
 */
export const integrationSettingsSchema = z.object({
  // Embeddings del RAG (Voyage AI).
  voyageKey: apiKeyStateSchema,
  voyageModel: z.string(),
  embeddingsProvider: z.string(), // "voyage" | "fake" — el que se usará

  // WhatsApp a nivel de app de Meta (no por número).
  whatsappAppId: z.string().nullable(),
  whatsappAppSecret: apiKeyStateSchema,
  whatsappVerifyToken: apiKeyStateSchema,
  whatsappGraphVersion: z.string(),
  // Si no hay app secret, la firma del webhook NO se verifica: hay que avisar.
  webhookSignatureVerified: z.boolean(),
});
export type IntegrationSettingsDto = z.infer<typeof integrationSettingsSchema>;

// Enviar "" en un secreto lo borra de la BD (vuelve al valor del .env).
export const updateIntegrationSettingsSchema = z.object({
  voyageKey: z.string().max(400).optional(),
  voyageModel: z.string().min(1).max(80).optional(),
  whatsappAppId: z.string().max(80).nullable().optional(),
  whatsappAppSecret: z.string().max(400).optional(),
  whatsappVerifyToken: z.string().max(400).optional(),
  whatsappGraphVersion: z.string().min(2).max(10).optional(),
});
export type UpdateIntegrationSettingsInput = z.infer<
  typeof updateIntegrationSettingsSchema
>;

// Resultado de "Probar" una integración concreta.
export const integrationTestTargets = ["voyage"] as const;
export type IntegrationTestTarget = (typeof integrationTestTargets)[number];

export const integrationTestSchema = z.object({
  target: z.enum(integrationTestTargets),
});
export type IntegrationTestInput = z.infer<typeof integrationTestSchema>;

export const integrationTestResultSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  latencyMs: z.number(),
});
export type IntegrationTestResult = z.infer<typeof integrationTestResultSchema>;
