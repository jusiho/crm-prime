"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AiMode,
  ConversationStatus,
  MessageType,
  type AiSuggestion,
  type ConversationDto,
} from "@crm/shared";
import {
  addNote,
  assignConversation,
  fetchAgents,
  fetchMessages,
  fetchNotes,
  fetchSources,
  reactToMessage,
  sendMessage,
  setAiMode,
  setConversationStatus,
  setContactSource,
  resolveAiActions,
  suggestReply,
  uploadMedia,
  type UploadedMedia,
} from "@/lib/bff";
import { toast } from "@/lib/toast";
import { MessageText } from "./MessageText";
import { MediaBubble } from "./MediaBubble";
import type { MessageDto } from "@crm/shared";

export function ChatWindow({ conversation }: { conversation: ConversationDto }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  // Archivo ya subido y pendiente de enviar (se manda al pulsar Enviar).
  const [attachment, setAttachment] = useState<UploadedMedia | null>(null);
  const [ai, setAi] = useState<AiSuggestion | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const suggestMut = useMutation({
    mutationFn: () => suggestReply(conversation.id),
    onSuccess: (s) => {
      setAi(s);
      if (s.suggestion) setText(s.suggestion);
    },
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", conversation.id],
    queryFn: () => fetchMessages(conversation.id),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const invalidateConvs = () =>
    queryClient.invalidateQueries({ queryKey: ["conversations"] });

  const sendMut = useMutation({
    mutationFn: async () => {
      await sendMessage({
        conversationId: conversation.id,
        // Con adjunto va como IMAGE/DOCUMENT y el texto viaja de pie de foto.
        ...(attachment
          ? {
              type:
                attachment.kind === "IMAGE"
                  ? MessageType.IMAGE
                  : MessageType.DOCUMENT,
              mediaUrl: attachment.mediaUrl,
              caption: text.trim() || undefined,
            }
          : { type: MessageType.TEXT, text: text.trim() }),
      });
      // Enviar la respuesta es la aprobación: se aplican las acciones que la
      // IA dejó pendientes (etiquetar, mover de etapa…).
      if (ai?.runId && ai.pendingActions.length) {
        return resolveAiActions(conversation.id, ai.runId, true);
      }
      return null;
    },
    onSuccess: (result) => {
      setText("");
      setAttachment(null);
      setAi(null);
      if (result?.executed.length) {
        toast.success(`Acciones aplicadas: ${result.executed.length}`);
        // Las acciones tocan contacto, etiquetas y pipeline.
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      }
      for (const err of result?.errors ?? []) toast.error(err);
      queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
      invalidateConvs();
    },
  });

  // Descartar la sugerencia rechaza también sus acciones pendientes.
  const discardAi = () => {
    const current = ai;
    setAi(null);
    if (current?.runId && current.pendingActions.length) {
      void resolveAiActions(conversation.id, current.runId, false).catch(
        () => undefined,
      );
    }
  };

  const reactMut = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      reactToMessage(messageId, emoji),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] }),
  });

  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const sourceMut = useMutation({
    mutationFn: (sourceId: string | null) =>
      setContactSource(conversation.contact.id, sourceId),
    onSuccess: invalidateConvs,
  });

  const assignMut = useMutation({
    mutationFn: (agentId: string | null) =>
      assignConversation(conversation.id, agentId),
    onSuccess: invalidateConvs,
  });

  const statusMut = useMutation({
    mutationFn: (status: ConversationStatus) =>
      setConversationStatus(conversation.id, status),
    onSuccess: invalidateConvs,
  });

  const aiModeMut = useMutation({
    mutationFn: (mode: AiMode) => setAiMode(conversation.id, mode),
    onSuccess: invalidateConvs,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header style={chatHeader}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong>
            {conversation.contact.name ?? conversation.contact.phone}
          </strong>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            {conversation.contact.phone}
          </span>
          {conversation.contact.tags.length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
              {conversation.contact.tags.map((t) => (
                <span key={t.name} style={tagChip(t.color)}>
                  {t.name}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Fuente:</span>
            <select
              value={conversation.contact.source?.id ?? ""}
              onChange={(e) => sourceMut.mutate(e.target.value || null)}
              disabled={sourceMut.isPending}
              style={sourceSelect}
            >
              <option value="">— Sin fuente —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={conversation.aiMode}
            onChange={(e) => aiModeMut.mutate(e.target.value as AiMode)}
            disabled={aiModeMut.isPending}
            title="Modo del agente IA"
            style={{
              ...control,
              borderColor:
                conversation.aiMode === AiMode.AUTOPILOT
                  ? "#3a64c8"
                  : conversation.aiMode === AiMode.COPILOT
                    ? "#3a4a6a"
                    : "var(--border)",
            }}
          >
            <option value={AiMode.OFF}>🤖 IA: Off</option>
            <option value={AiMode.COPILOT}>🤖 IA: Copilot</option>
            <option value={AiMode.AUTOPILOT}>🤖 IA: Autopilot</option>
          </select>
          {conversation.aiPaused && (
            <span
              title="La IA está en pausa tras intervención humana"
              style={{ fontSize: 11, color: "#e0a458" }}
            >
              ⏸ IA en pausa
            </span>
          )}
          <select
            value={conversation.assignedAgent?.id ?? ""}
            onChange={(e) => assignMut.mutate(e.target.value || null)}
            disabled={assignMut.isPending}
            title="Asignar a"
            style={control}
          >
            <option value="">Sin asignar</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.email}
              </option>
            ))}
          </select>
          <select
            value={conversation.status}
            onChange={(e) =>
              statusMut.mutate(e.target.value as ConversationStatus)
            }
            disabled={statusMut.isPending}
            title="Estado"
            style={control}
          >
            <option value={ConversationStatus.OPEN}>Abierta</option>
            <option value={ConversationStatus.PENDING}>Pendiente</option>
            <option value={ConversationStatus.CLOSED}>Cerrada</option>
          </select>
          <button
            onClick={() => setShowNotes((v) => !v)}
            style={{ ...control, cursor: "pointer" }}
            title="Notas internas"
          >
            Notas
          </button>
        </div>
      </header>

      {showNotes && <NotesPanel conversationId={conversation.id} />}

      <div style={messagesArea}>
        {isLoading && <ChatSkeleton />}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onReact={(emoji) => reactMut.mutate({ messageId: m.id, emoji })}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {ai && (
        <div style={ai.escalate ? aiBannerWarn : aiBanner}>
          {ai.escalate ? (
            <span>
              ⚠️ La IA recomienda <strong>escalar a un humano</strong>
              {ai.escalationReason ? `: ${ai.escalationReason}` : ""}.
            </span>
          ) : (
            <span>
              ✨ Sugerencia de IA cargada en el cuadro — revísala y edítala antes
              de enviar.
            </span>
          )}
          {ai.pendingActions.length > 0 && (
            <div style={actionsBox}>
              <strong style={{ fontSize: 12 }}>
                Al enviar se aplicará en el CRM:
              </strong>
              <ul style={{ margin: "5px 0 0", paddingLeft: 18 }}>
                {ai.pendingActions.map((a) => (
                  <li key={a.id} style={{ fontSize: 12.5 }}>
                    {a.summary}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <span style={{ color: "var(--muted)", fontSize: 11 }}>
            {ai.classification && (
              <>
                {ai.classification.intent} · {sentimentLabel(ai.classification.sentiment)}
                {ai.classification.urgency === "high" ? " · 🔴 urgente" : ""} ·{" "}
              </>
            )}
            {ai.provider}/{ai.model}
            {ai.toolsUsed.length ? ` · ${ai.toolsUsed.join(", ")}` : ""}
            {" · "}
            <button onClick={discardAi} style={discardBtn}>
              descartar
            </button>
          </span>
        </div>
      )}

      {attachment && (
        <AttachmentPreview
          attachment={attachment}
          onRemove={() => setAttachment(null)}
        />
      )}

      {conversation.windowOpen ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() || attachment) sendMut.mutate();
          }}
          style={composer}
        >
          <button
            type="button"
            onClick={() => suggestMut.mutate()}
            disabled={suggestMut.isPending}
            title="Sugerir respuesta con IA (copilot)"
            style={aiBtn}
          >
            {suggestMut.isPending ? "✨…" : "✨ IA"}
          </button>
          <AttachButton
            attachment={attachment}
            onAttached={setAttachment}
            disabled={sendMut.isPending}
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              attachment ? "Añade un pie de foto (opcional)…" : "Escribe un mensaje…"
            }
            style={input}
          />
          <button
            type="submit"
            disabled={sendMut.isPending || (!text.trim() && !attachment)}
            style={sendBtn}
          >
            {sendMut.isPending ? "…" : "Enviar"}
          </button>
        </form>
      ) : (
        <div style={windowClosed}>
          Ventana de 24h cerrada. Solo se pueden enviar plantillas aprobadas
          (Fase 3).
        </div>
      )}
      {sendMut.isError && (
        <div style={{ color: "#ff6b6b", padding: "0 16px 12px", fontSize: 13 }}>
          {(sendMut.error as Error).message}
        </div>
      )}
    </div>
  );
}

/** Botón de clip: sube el archivo al elegirlo y deja la referencia lista. */
function AttachButton({
  attachment,
  onAttached,
  disabled,
}: {
  attachment: UploadedMedia | null;
  onAttached: (m: UploadedMedia) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => uploadMedia(file),
    onSuccess: onAttached,
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          // Permite volver a elegir el mismo archivo tras quitarlo.
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || upload.isPending || !!attachment}
        title={attachment ? "Ya hay un archivo adjunto" : "Adjuntar archivo"}
        style={attachBtn}
      >
        {upload.isPending ? "…" : "📎"}
      </button>
    </>
  );
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: UploadedMedia;
  onRemove: () => void;
}) {
  const kb = Math.round(attachment.size / 1024);
  return (
    <div style={previewBar}>
      {attachment.kind === "IMAGE" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.previewUrl.replace("/api/v1/media/", "/api/bff/media/")}
          alt={attachment.fileName}
          style={{ height: 44, borderRadius: 6, objectFit: "cover" }}
        />
      ) : (
        <span style={{ fontSize: 22 }}>📄</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {attachment.fileName}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          {kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`}
        </div>
      </div>
      <button onClick={onRemove} style={removeBtn} title="Quitar">
        ✕
      </button>
    </div>
  );
}

const attachBtn = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
} as React.CSSProperties;

const previewBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 16px",
  borderTop: "1px solid var(--border)",
  background: "var(--panel)",
};

const removeBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 14,
};

function NotesPanel({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes", conversationId],
    queryFn: () => fetchNotes(conversationId),
  });

  const add = useMutation({
    mutationFn: () => addNote(conversationId, body.trim()),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["notes", conversationId] });
    },
  });

  return (
    <div style={notesPanel}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
        Notas internas (no se envían al contacto)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
        {isLoading && <span style={{ color: "var(--muted)", fontSize: 13 }}>Cargando…</span>}
        {!isLoading && notes.length === 0 && (
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Sin notas.</span>
        )}
        {notes.map((n) => (
          <div key={n.id} style={noteItem}>
            <div style={{ fontSize: 13 }}>{n.body}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              {n.author.name ?? "Agente"} ·{" "}
              {new Date(n.createdAt).toLocaleString("es")}
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate();
        }}
        style={{ display: "flex", gap: 8, marginTop: 8 }}
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Agregar nota…"
          style={{ ...input, padding: "8px 10px" }}
        />
        <button type="submit" disabled={add.isPending} style={sendBtn}>
          Añadir
        </button>
      </form>
    </div>
  );
}

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function MessageBubble({
  message: m,
  onReact,
}: {
  message: MessageDto;
  onReact: (emoji: string) => void;
}) {
  const out = m.direction === "OUTBOUND";
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      className="msg-row"
      style={{
        alignSelf: out ? "flex-end" : "flex-start",
        maxWidth: "78%",
        minWidth: 0,
        display: "flex",
        flexDirection: out ? "row-reverse" : "row",
        alignItems: "center",
        gap: 6,
        position: "relative",
      }}
    >
      <div
        style={{
          background: out ? "#1c3a6e" : "#1c2738",
          color: "var(--text)",
          padding: "8px 12px",
          borderRadius: 10,
          position: "relative",
        }}
      >
        {m.mediaUrl && (
          <MediaBubble
            mediaUrl={m.mediaUrl}
            type={m.type}
            caption={m.content}
          />
        )}
        {m.content ? (
          <MessageText text={m.content} />
        ) : (
          !m.mediaUrl && (
            <div style={{ opacity: 0.6 }}>[{m.type.toLowerCase()}]</div>
          )
        )}
        {out && (
          <div style={{ fontSize: 11, color: "#a9c3ff", textAlign: "right", marginTop: 2 }}>
            {m.author === "AI" ? "IA · " : ""}
            {m.status.toLowerCase()}
          </div>
        )}
        {m.reaction && (
          <span
            style={{
              position: "absolute",
              bottom: -10,
              [out ? "left" : "right"]: 8,
              background: "#0d1320",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "0 5px",
              fontSize: 13,
              lineHeight: "18px",
            }}
          >
            {m.reaction}
          </span>
        )}
      </div>

      {/* Disparador de reacción (aparece al pasar el cursor) */}
      <button
        className="react-trigger"
        onClick={() => setPickerOpen((v) => !v)}
        title="Reaccionar"
        style={reactTriggerBtn}
      >
        ☺
      </button>

      {pickerOpen && (
        <div style={emojiPicker}>
          {REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => {
                onReact(m.reaction === e ? "" : e);
                setPickerOpen(false);
              }}
              style={emojiBtn}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const reactTriggerBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 16,
  padding: 2,
};

const emojiPicker: React.CSSProperties = {
  position: "absolute",
  top: -42,
  display: "flex",
  gap: 2,
  background: "#0d1320",
  border: "1px solid var(--border)",
  borderRadius: 999,
  padding: "4px 6px",
  zIndex: 5,
  boxShadow: "var(--shadow)",
};

const emojiBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 18,
  padding: "2px 3px",
  borderRadius: 6,
};

const sourceSelect: React.CSSProperties = {
  background: "#0d1320",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 7,
  fontSize: 12,
  padding: "3px 8px",
};

function tagChip(color: string | null): React.CSSProperties {
  const bg = color && /^#?[0-9a-fA-F]{3,8}$/.test(color)
    ? color.startsWith("#") ? color : `#${color}`
    : "#2c4b7a";
  return {
    fontSize: 11,
    padding: "1px 8px",
    borderRadius: 999,
    background: bg,
    color: "#eaf2ff",
  };
}

function sentimentLabel(s: string): string {
  if (s === "negative") return "😟 negativo";
  if (s === "positive") return "🙂 positivo";
  return "😐 neutral";
}

function ChatSkeleton() {
  const rows = [
    { side: "flex-start", w: 180 },
    { side: "flex-end", w: 220 },
    { side: "flex-start", w: 140 },
    { side: "flex-end", w: 200 },
    { side: "flex-start", w: 240 },
  ] as const;
  return (
    <>
      {rows.map((r, i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            alignSelf: r.side,
            width: r.w,
            maxWidth: "70%",
            height: 38,
            borderRadius: 10,
            opacity: 0.8,
          }}
        />
      ))}
    </>
  );
}

const chatHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 16px",
  borderBottom: "1px solid var(--border)",
};

const control: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 13,
};

const notesPanel: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--border)",
  background: "#0e1420",
};

const noteItem: React.CSSProperties = {
  background: "#1c2738",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
};

const messagesArea: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const composer: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: 12,
  borderTop: "1px solid var(--border)",
};

const input: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
};

const sendBtn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  fontWeight: 600,
  cursor: "pointer",
};

const windowClosed: React.CSSProperties = {
  padding: 16,
  borderTop: "1px solid var(--border)",
  color: "#e0a458",
  fontSize: 13,
};

const aiBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #3a4a6a",
  background: "#16203a",
  color: "#a9c3ff",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const aiBanner: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 12,
  padding: "8px 16px",
  borderTop: "1px solid var(--border)",
  background: "#101a2e",
  color: "#a9c3ff",
  fontSize: 13,
};

// Ocupa toda la fila del banner (que es flex) para quedar bajo el texto.
const actionsBox: React.CSSProperties = {
  flexBasis: "100%",
  order: 3,
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border)",
  color: "var(--text)",
};

const discardBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 11,
  textDecoration: "underline",
  padding: 0,
};

const aiBannerWarn: React.CSSProperties = {
  ...aiBanner,
  background: "#2a2113",
  color: "#e0b766",
};
