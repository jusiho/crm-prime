import { z } from "zod";
import { MessageType } from "../enums.js";

// Respuestas rápidas del agente ("plantillas normales"): textos guardados que
// se insertan en el chat dentro de la ventana de 24h. No pasan por Meta.

const shortcutField = z
  .string()
  .min(2)
  .max(32)
  .regex(
    /^\/[a-z0-9_-]+$/,
    'El atajo empieza por "/" y solo admite minúsculas, números, "-" y "_"',
  );

const mediaKinds = [MessageType.IMAGE, MessageType.DOCUMENT] as const;

export const quickReplyDtoSchema = z.object({
  id: z.string(),
  shortcut: z.string(),
  title: z.string(),
  body: z.string(),
  mediaUrl: z.string().nullable(),
  mediaType: z.enum(mediaKinds).nullable(),
  createdAt: z.string(),
});
export type QuickReplyDto = z.infer<typeof quickReplyDtoSchema>;

export const createQuickReplySchema = z.object({
  shortcut: shortcutField,
  title: z.string().min(1).max(80),
  // Admite {{nombre}} y {{telefono}}, que se sustituyen al insertarla.
  body: z.string().min(1).max(4096),
  mediaUrl: z.string().nullable().default(null),
  mediaType: z.enum(mediaKinds).nullable().default(null),
});
export type CreateQuickReplyInput = z.infer<typeof createQuickReplySchema>;

export const updateQuickReplySchema = createQuickReplySchema.partial();
export type UpdateQuickReplyInput = z.infer<typeof updateQuickReplySchema>;

/** Sustituye los huecos de una respuesta rápida con los datos del contacto. */
export function renderQuickReply(
  body: string,
  contact: { name?: string | null; phone?: string | null },
): string {
  return body
    .replace(/\{\{\s*nombre\s*\}\}/gi, contact.name ?? "")
    .replace(/\{\{\s*telefono\s*\}\}/gi, contact.phone ?? "");
}
