import { z } from "zod";

// Un número de WhatsApp conectado (un "canal").
export const whatsappChannelSchema = z.object({
  id: z.string(), // id de la conexión ("env" para el del .env)
  phoneNumberId: z.string(),
  displayPhoneNumber: z.string().nullable(),
  label: z.string().nullable(), // alias visible: "Ventas", "Soporte"…
  wabaId: z.string().nullable(),
  mode: z.string(), // coexistence | api
  status: z.string(), // connected | error
  // Por qué está en error (token caducado, permisos…). Null si va bien.
  statusReason: z.string().nullable(),
  source: z.string(), // embedded | env
  isActive: z.boolean(),
  connectedAt: z.string().nullable(),
  // Embudo al que entran sus conversaciones nuevas; null = el predeterminado.
  pipelineId: z.string().nullable(),
});
export type WhatsappChannel = z.infer<typeof whatsappChannelSchema>;

// Lista de canales que muestra el panel (multi-número).
export const whatsappChannelsSchema = z.object({
  channels: z.array(whatsappChannelSchema),
});
export type WhatsappChannels = z.infer<typeof whatsappChannelsSchema>;

// Comprobar que el token de un canal sigue siendo válido contra Meta.
export const testChannelSchema = z.object({
  phoneNumberId: z.string().min(1),
});
export type TestChannelInput = z.infer<typeof testChannelSchema>;

export const channelTestResultSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  displayPhoneNumber: z.string().nullable(),
});
export type ChannelTestResult = z.infer<typeof channelTestResultSchema>;

// Estado agregado (compatibilidad: ¿hay al menos un número conectado?).
export const whatsappConnectionStatusSchema = z.object({
  connected: z.boolean(),
  phoneNumberId: z.string().nullable(),
  displayPhoneNumber: z.string().nullable(),
  wabaId: z.string().nullable(),
  mode: z.string().nullable(), // coexistence | api
  source: z.string().nullable(), // embedded | env | null
});
export type WhatsappConnectionStatus = z.infer<
  typeof whatsappConnectionStatusSchema
>;

// Datos que envía el Embedded Signup al conectar un número.
export const connectWhatsappSchema = z
  .object({
    code: z.string().optional(), // código del Embedded Signup (se canjea por token)
    accessToken: z.string().optional(), // o un token directo
    wabaId: z.string().optional(),
    phoneNumberId: z.string().min(1),
    displayPhoneNumber: z.string().optional(),
    label: z.string().max(60).optional(), // alias opcional del número
    mode: z.enum(["coexistence", "api"]).default("coexistence"),
  })
  .refine((v) => !!v.code || !!v.accessToken, {
    message: "Se requiere code o accessToken",
  });
export type ConnectWhatsappInput = z.infer<typeof connectWhatsappSchema>;

// Desconectar un número concreto (por su phoneNumberId).
export const disconnectWhatsappSchema = z.object({
  phoneNumberId: z.string().min(1),
});
export type DisconnectWhatsappInput = z.infer<typeof disconnectWhatsappSchema>;

// ── Conector en dominio fijo (SaaS) ─────────────────────────
// El SDK de Meta corre en el dominio raíz; el panel de la empresa pide un pase
// y salta allí. Ver ConnectHubController en la API.

/** Respuesta al pedir el pase. `connectUrl: null` = instalación de una sola empresa. */
export interface ConnectTicketResult {
  ticket: string | null;
  connectUrl: string | null;
}

/** Lo que el conector manda a la API al terminar el Embedded Signup. */
export const connectWithTicketSchema = z.object({
  ticket: z.string().min(1),
  code: z.string().min(1),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().optional(),
  mode: z.enum(["coexistence", "api"]).default("coexistence"),
});
export type ConnectWithTicketInput = z.infer<typeof connectWithTicketSchema>;

export interface ConnectWithTicketResult {
  ok: true;
  /** A dónde vuelve el usuario: el panel de su empresa, ya con el número guardado. */
  returnUrl: string;
}
