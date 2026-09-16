"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
  mediaSrc,
  type UploadedMedia,
} from "@/lib/bff";
import { toast } from "@/lib/toast";
import { MessageText } from "./MessageText";
import { SendTemplateDialog } from "./SendTemplateDialog";
import { SendButtonsDialog } from "./SendButtonsDialog";
import { MediaBubble } from "./MediaBubble";
import { AiModeSwitch } from "./AiModeSwitch";
import { Composer } from "./Composer";
import {
  AiTypingBubble,
  DaySeparator,
  MessageStatus,
  MessagesSkeleton,
  isNewDay,
} from "./ChatBits";
import { NavIcon } from "@/components/NavIcons";
import type { MessageDto } from "@crm/shared";

export function ChatWindow({ conversation }: { conversation: ConversationDto }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  // Archivo ya subido y pendiente de enviar (se manda al pulsar Enviar).
  const [attachment, setAttachment] = useState<UploadedMedia | null>(null);
  // Mensaje citado en la respuesta que se está redactando.
  const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [buttonsOpen, setButtonsOpen] = useState(false);

  /**
   * Adjunta un archivo que ya está guardado (el de una respuesta rápida), sin
   * volver a subirlo. El tamaño real no lo sabemos aquí y no hace falta: solo
   * se usa para el envío.
   */
  function attachSaved(mediaUrl: string, kind: "IMAGE" | "DOCUMENT") {
    setAttachment({
      mediaUrl,
      previewUrl: mediaSrc(mediaUrl) ?? "",
      kind,
      mimeType: kind === "IMAGE" ? "image/jpeg" : "application/octet-stream",
      size: 0,
      fileName: "Adjunto de la respuesta rápida",
    });
  }
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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

  // Filtro del buscador: se aplica sobre lo ya cargado, sin ir al servidor.
  const searching = searchOpen && search.trim().length > 0;
  const visible = useMemo(() => {
    if (!searching) return messages;
    const q = search.trim().toLowerCase();
    return messages.filter((m) => (m.content ?? "").toLowerCase().includes(q));
  }, [messages, search, searching]);

  // La IA está redactando: o la pediste tú (copilot), o el autopilot está al
  // mando y el contacto escribió lo último.
  const aiThinking =
    suggestMut.isPending ||
    (conversation.aiMode === AiMode.AUTOPILOT &&
      !conversation.aiPaused &&
      messages.length > 0 &&
      messages[messages.length - 1]?.direction === "INBOUND");

  const invalidateConvs = () =>
    queryClient.invalidateQueries({ queryKey: ["conversations"] });

  const sendMut = useMutation({
    mutationFn: async () => {
      await sendMessage({
        conversationId: conversation.id,
        // Con adjunto va como IMAGE/DOCUMENT y el texto viaja de pie de foto.
        ...(replyTo ? { replyToId: replyTo.id } : {}),
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
      setReplyTo(null);
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

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadMedia(file),
    onSuccess: setAttachment,
    onError: (e) => toast.error((e as Error).message),
  });

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
        <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
          <span style={avatar} aria-hidden>
            {initials(
              conversation.contact.name ?? conversation.contact.phone,
            )}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <strong style={{ fontSize: 16 }}>
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
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <AiModeSwitch
            value={conversation.aiMode}
            paused={conversation.aiPaused}
            disabled={aiModeMut.isPending}
            onChange={(m) => aiModeMut.mutate(m)}
          />
          <button
            type="button"
            onClick={() => {
              setSearchOpen((v) => !v);
              setSearch("");
            }}
            title="Buscar en la conversación"
            style={{
              ...control,
              padding: "7px 9px",
              color: searchOpen ? "var(--accent)" : "var(--muted)",
            }}
          >
            <NavIcon name="search" size={16} />
          </button>
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
        {isLoading && <MessagesSkeleton />}
        {!isLoading && messages.length === 0 && (
          <div style={emptyThread}>
            <NavIcon name="message" size={28} />
            <p style={{ margin: "10px 0 0", fontWeight: 600 }}>
              Todavía no hay mensajes
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>
              Escribe abajo para empezar la conversación.
            </p>
          </div>
        )}
        {searching && visible.length === 0 && messages.length > 0 && (
          <div style={emptyThread}>
            <NavIcon name="search" size={24} />
            <p style={{ margin: "10px 0 0", fontSize: 13 }}>
              Ningún mensaje contiene «{search.trim()}».
            </p>
          </div>
        )}
        {visible.map((m, i) => (
          <Fragment key={m.id}>
            {/* Sin búsqueda activa los separadores orientan; con ella
                estorbarían, porque el hilo ya no es continuo. */}
            {!searching && isNewDay(m.createdAt, visible[i - 1]?.createdAt) && (
              <DaySeparator date={new Date(m.createdAt)} />
            )}
            <MessageBubble
              message={m}
              highlight={searching ? search.trim() : null}
              onReact={(emoji) => reactMut.mutate({ messageId: m.id, emoji })}
              onReply={() => setReplyTo(m)}
            />
          </Fragment>
        ))}
        {aiThinking && <AiTypingBubble />}
        <div ref={bottomRef} />
      </div>

      {searchOpen && (
        <div style={searchBar}>
          <NavIcon name="search" size={15} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en este hilo…"
            style={searchInput}
          />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {search.trim()
              ? `${visible.length} de ${messages.length}`
              : `${messages.length} mensajes`}
          </span>
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearch("");
            }}
            style={{ ...control, padding: "5px 7px" }}
            title="Cerrar"
          >
            <NavIcon name="x" size={14} />
          </button>
        </div>
      )}

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
        <>
          <div style={suggestRow}>
            <button
              type="button"
              onClick={() => suggestMut.mutate()}
              disabled={suggestMut.isPending}
              title="Que la IA redacte una respuesta para que tú la revises"
              style={aiBtn}
            >
              <NavIcon name="sparkles" size={14} />
              {suggestMut.isPending ? "Redactando…" : "Sugerir con IA"}
            </button>
          </div>
          <Composer
            text={text}
            onTextChange={setText}
            onSend={() => sendMut.mutate()}
            sending={sendMut.isPending}
            attachment={attachment}
            onAttach={(f) => uploadMut.mutate(f)}
            onRemoveAttachment={() => setAttachment(null)}
            uploading={uploadMut.isPending}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            contact={conversation.contact}
            onAttachSaved={attachSaved}
            onOpenTemplates={() => setTemplateOpen(true)}
            onOpenButtons={() => setButtonsOpen(true)}
            windowOpen
          />
        </>
      ) : (
        <div style={windowClosed}>
          <div>
            Pasaron más de 24h desde el último mensaje del cliente. WhatsApp
            solo permite escribirle con una plantilla aprobada.
          </div>
          <button
            onClick={() => setTemplateOpen(true)}
            style={sendTemplateBtn}
            type="button"
          >
            Enviar una plantilla
          </button>
        </div>
      )}

      {templateOpen && (
        <SendTemplateDialog
          conversationId={conversation.id}
          onClose={() => setTemplateOpen(false)}
        />
      )}
      {buttonsOpen && (
        <SendButtonsDialog
          conversationId={conversation.id}
          onClose={() => setButtonsOpen(false)}
        />
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
  onReply,
  highlight,
}: {
  message: MessageDto;
  onReact: (emoji: string) => void;
  onReply: () => void;
  highlight: string | null;
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
        {/* Cita: qué se está respondiendo, como en WhatsApp. */}
        {m.replyTo && (
          <div style={quotedBlock}>
            <div style={quotedWho}>
              {m.replyTo.direction === "OUTBOUND" ? "Tú" : "Cliente"}
            </div>
            <div style={quotedText}>
              {m.replyTo.content || `[${m.replyTo.type.toLowerCase()}]`}
            </div>
          </div>
        )}
        {m.mediaUrl && (
          <MediaBubble
            mediaUrl={m.mediaUrl}
            type={m.type}
            caption={m.content}
          />
        )}
        {m.content ? (
          <MessageText text={m.content} highlight={highlight} />
        ) : (
          !m.mediaUrl && (
            <div style={{ opacity: 0.6 }}>[{m.type.toLowerCase()}]</div>
          )
        )}
        {m.buttons && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
            {m.buttons.map((b) => (
              <div key={b.id} style={messageButton}>
                {b.title}
              </div>
            ))}
          </div>
        )}
        <div style={metaRow(out)}>
          <span style={{ fontSize: 10.5, color: "rgba(230,237,246,0.45)" }}>
            {new Date(m.createdAt).toLocaleTimeString("es", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {out && <MessageStatus status={m.status} author={m.author} />}
        </div>
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

const messageButton: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  color: "#53bdeb",
  textAlign: "center",
  borderRadius: 7,
  padding: "6px 8px",
  fontSize: 12.5,
};

const sendTemplateBtn: React.CSSProperties = {
  marginTop: 10,
  padding: "8px 14px",
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

// Iniciales del contacto: identidad sin pedir foto a nadie.
function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  const clean = value.replace(/\D/g, "");
  return (clean.slice(-2) || value.slice(0, 2)).toUpperCase();
}

const avatar: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 40,
  flexShrink: 0,
  borderRadius: "50%",
  background: "rgba(37,211,102,0.14)",
  color: "var(--positive, #7ee2a8)",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "0.01em",
};

const searchBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "8px 16px",
  borderBottom: "1px solid var(--border)",
  background: "var(--panel, #131a26)",
  color: "var(--muted)",
};

const searchInput: React.CSSProperties = {
  flex: 1,
  padding: "6px 0",
  border: "none",
  background: "transparent",
  color: "var(--text)",
  fontSize: 13.5,
  outline: "none",
};

const suggestRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  padding: "8px 16px 0",
};

const emptyThread: React.CSSProperties = {
  margin: "auto",
  textAlign: "center",
  color: "var(--muted)",
  padding: 24,
};

// Cita dentro de la burbuja: barra de acento a la izquierda y texto apagado.
const quotedBlock: React.CSSProperties = {
  borderLeft: "3px solid var(--accent, #25d366)",
  paddingLeft: 8,
  marginBottom: 6,
  opacity: 0.85,
};

const quotedWho: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--accent, #25d366)",
};

const quotedText: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--muted)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

function metaRow(out: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    justifyContent: out ? "flex-end" : "flex-start",
    marginTop: 3,
  };
}

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
