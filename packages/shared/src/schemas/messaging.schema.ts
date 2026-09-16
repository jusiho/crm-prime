import { z } from "zod";
import { phoneField } from "./contact.schema.js";
import { templateFillSchema } from "./template.schema.js";
import {
  AiMode,
  ConversationStatus,
  MessageAuthor,
  MessageDirection,
  MessageStatus,
  MessageType,
} from "../enums.js";

// ── Enviar mensaje saliente ─────────────────────────────────
export const sendMessageSchema = z
  .object({
    conversationId: z.string(),
    type: z
      .enum([MessageType.TEXT, MessageType.IMAGE, MessageType.DOCUMENT])
      .default(MessageType.TEXT),
    text: z.string().max(4096).optional(),
    mediaUrl: z.string().url().optional(),
    caption: z.string().max(1024).optional(),
    // Id de NUESTRO mensaje citado; se traduce al waMessageId para Meta.
    replyToId: z.string().optional(),
  })
  .refine(
    (v) => (v.type === MessageType.TEXT ? !!v.text : !!v.mediaUrl),
    "Texto requerido para TEXT; mediaUrl requerido para IMAGE/DOCUMENT",
  );
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// ── Mensaje con botones (interactivo, sin plantilla) ────────
// Solo dentro de la ventana de 24h, pero no necesita aprobación de Meta.
// Meta admite como máximo 3 botones de 20 caracteres.
export const interactiveButtonSchema = z.object({
  id: z.string().max(256).optional(),
  title: z.string().min(1).max(20),
});
export type InteractiveButtonInput = z.infer<typeof interactiveButtonSchema>;

export const sendInteractiveSchema = z.object({
  conversationId: z.string(),
  body: z.string().min(1).max(1024),
  header: z.string().max(60).optional(),
  footer: z.string().max(60).optional(),
  buttons: z.array(interactiveButtonSchema).min(1).max(3),
});
export type SendInteractiveInput = z.infer<typeof sendInteractiveSchema>;

// ── Enviar una plantilla a una conversación ─────────────────
export const sendTemplateMessageSchema = z.object({
  conversationId: z.string(),
  templateId: z.string(),
  fill: templateFillSchema.default({ body: [], urlButtons: [] }),
});
export type SendTemplateMessageInput = z.infer<typeof sendTemplateMessageSchema>;

// ── Simular un mensaje entrante (solo dev) ──────────────────
export const simulateInboundSchema = z.object({
  // Normalizado igual que la entrada real de Meta, para que simular no cree
  // contactos con un formato distinto al de producción.
  phone: phoneField,
  name: z.string().optional(),
  text: z.string().min(1),
});
export type SimulateInboundInput = z.infer<typeof simulateInboundSchema>;

// ── DTOs de salida ──────────────────────────────────────────
export const messageDtoSchema = z.object({
  id: z.string(),
  direction: z.nativeEnum(MessageDirection),
  type: z.nativeEnum(MessageType),
  author: z.nativeEnum(MessageAuthor),
  content: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  reaction: z.string().nullable(),
  status: z.nativeEnum(MessageStatus),
  createdAt: z.string(),
  /** Botones enviados con el mensaje (interactivo), para pintarlos en el hilo. */
  buttons: z.array(z.object({ id: z.string(), title: z.string() })).nullable(),
  // Mensaje citado, aplanado a lo justo para pintar la cita sin otra consulta.
  replyTo: z
    .object({
      id: z.string(),
      content: z.string().nullable(),
      type: z.nativeEnum(MessageType),
      direction: z.nativeEnum(MessageDirection),
    })
    .nullable(),
});
export type MessageDto = z.infer<typeof messageDtoSchema>;

// Reaccionar a un mensaje (emoji vacío = quitar la reacción).
export const reactMessageSchema = z.object({
  messageId: z.string(),
  emoji: z.string().max(8),
});
export type ReactMessageInput = z.infer<typeof reactMessageSchema>;

export const assignedAgentSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
});

export const conversationDtoSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(ConversationStatus),
  contact: z.object({
    id: z.string(),
    phone: z.string(),
    name: z.string().nullable(),
    tags: z
      .array(z.object({ name: z.string(), color: z.string().nullable() }))
      .default([]),
    source: z
      .object({ id: z.string(), name: z.string(), color: z.string().nullable() })
      .nullable()
      .default(null),
  }),
  assignedAgent: assignedAgentSchema.nullable(),
  // Número (canal) de WhatsApp por el que entró la conversación (multi-número).
  channel: z
    .object({
      id: z.string(),
      label: z.string().nullable(),
      displayPhoneNumber: z.string().nullable(),
    })
    .nullable(),
  aiMode: z.nativeEnum(AiMode),
  aiPaused: z.boolean(),
  // El contacto escribió y aún no le respondemos (pendiente de responder).
  awaitingReply: z.boolean(),
  windowExpiresAt: z.string().nullable(),
  windowOpen: z.boolean(),
  lastMessageAt: z.string().nullable(),
  unread: z.number().optional(),
});
export type ConversationDto = z.infer<typeof conversationDtoSchema>;

export const setAiModeSchema = z.object({
  mode: z.nativeEnum(AiMode),
});
export type SetAiModeInput = z.infer<typeof setAiModeSchema>;

// ── Filtros de la bandeja ───────────────────────────────────
export const conversationFilter = ["all", "unassigned", "mine"] as const;
export type ConversationFilter = (typeof conversationFilter)[number];

// Filtro por estado de respuesta: pendientes vs ya respondidas.
export const replyFilter = ["all", "pending", "replied"] as const;
export type ReplyFilter = (typeof replyFilter)[number];

export const conversationsQuerySchema = z.object({
  filter: z.enum(conversationFilter).default("all"),
  reply: z.enum(replyFilter).default("all"),
  status: z.nativeEnum(ConversationStatus).optional(),
});
export type ConversationsQuery = z.infer<typeof conversationsQuerySchema>;

// ── Acciones sobre la conversación ──────────────────────────
export const assignConversationSchema = z.object({
  agentId: z.string().nullable(), // null = liberar
});
export type AssignConversationInput = z.infer<typeof assignConversationSchema>;

export const setStatusSchema = z.object({
  status: z.nativeEnum(ConversationStatus),
});
export type SetStatusInput = z.infer<typeof setStatusSchema>;

// ── Notas internas ──────────────────────────────────────────
export const createNoteSchema = z.object({
  body: z.string().min(1).max(2000),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const noteDtoSchema = z.object({
  id: z.string(),
  body: z.string(),
  author: z.object({ id: z.string(), name: z.string().nullable() }),
  createdAt: z.string(),
});
export type NoteDto = z.infer<typeof noteDtoSchema>;

// ── Agentes (para asignación) ───────────────────────────────
export const agentDtoSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
});
export type AgentDto = z.infer<typeof agentDtoSchema>;
