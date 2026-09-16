"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MessageDto, QuickReplyDto } from "@crm/shared";
import { renderQuickReply } from "@crm/shared";
import { fetchQuickReplies, type UploadedMedia } from "@/lib/bff";
import { NavIcon } from "@/components/NavIcons";
import { EmojiPicker } from "./EmojiPicker";

/**
 * Cuadro de redacción del inbox.
 *
 * Antes era un `<input>` de una sola línea, así que era imposible enviar un
 * mensaje con saltos — justo lo que el hilo ya sabe renderizar. Ahora es un
 * textarea que crece solo, con Enter para enviar y Shift+Enter para saltar,
 * más dos atajos del oficio: adjuntar y respuestas rápidas con "/".
 */
export function Composer({
  text,
  onTextChange,
  onSend,
  sending,
  attachment,
  onAttach,
  onRemoveAttachment,
  uploading,
  replyTo,
  onCancelReply,
  contact,
  onAttachSaved,
  onOpenTemplates,
  onOpenButtons,
  windowOpen,
}: {
  text: string;
  onTextChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  attachment: UploadedMedia | null;
  onAttach: (file: File) => void;
  onRemoveAttachment: () => void;
  uploading: boolean;
  replyTo: MessageDto | null;
  onCancelReply: () => void;
  /** Para sustituir {{nombre}} y {{telefono}} en las respuestas rápidas. */
  contact?: { name?: string | null; phone?: string | null };
  /** Adjunta un archivo ya guardado (el de una respuesta rápida). */
  onAttachSaved: (mediaUrl: string, kind: "IMAGE" | "DOCUMENT") => void;
  onOpenTemplates: () => void;
  onOpenButtons: () => void;
  /** Dentro de las 24h se puede escribir libre; fuera, solo plantillas. */
  windowOpen: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Las respuestas rápidas solo se piden cuando el usuario abre el menú.
  const { data: quickReplies = [] } = useQuery({
    queryKey: ["quick-replies"],
    queryFn: fetchQuickReplies,
    enabled: quickOpen,
  });

  // Crecer con el contenido, con tope para no comerse el hilo.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  // Al citar, el foco va al cuadro: se responde escribiendo, sin clic extra.
  useEffect(() => {
    if (replyTo) areaRef.current?.focus();
  }, [replyTo]);

  // "/" al principio de un cuadro vacío abre las respuestas rápidas.
  const slashQuery = useMemo(
    () => (text.startsWith("/") ? text.slice(1).toLowerCase().trim() : null),
    [text],
  );
  const matches = useMemo(() => {
    if (slashQuery === null) return [];
    return quickReplies
      .filter(
        (q) =>
          !slashQuery ||
          q.shortcut.slice(1).toLowerCase().includes(slashQuery) ||
          q.title.toLowerCase().includes(slashQuery) ||
          q.body.toLowerCase().includes(slashQuery),
      )
      .slice(0, 6);
  }, [quickReplies, slashQuery]);

  useEffect(() => {
    if (slashQuery !== null) setQuickOpen(true);
  }, [slashQuery]);

  const showQuick = quickOpen && slashQuery !== null;
  const canSend = (!!text.trim() || !!attachment) && !sending;

  /**
   * Inserta el emoji donde está el cursor y lo deja justo detrás. Añadirlo al
   * final sería lo fácil, pero rompe la escritura en cuanto el vendedor vuelve
   * atrás a corregir una palabra.
   */
  function insertEmoji(emoji: string) {
    const el = areaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    onTextChange(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const at = start + emoji.length;
      el.setSelectionRange(at, at);
    });
  }

  /** Inserta la respuesta rápida, ya con el nombre del contacto sustituido. */
  function insertQuickReply(q: QuickReplyDto) {
    onTextChange(renderQuickReply(q.body, contact ?? {}));
    if (q.mediaUrl && q.mediaType) onAttachSaved(q.mediaUrl, q.mediaType);
    setQuickOpen(false);
    areaRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showQuick && e.key === "Escape") {
      setQuickOpen(false);
      return;
    }
    // Enter envía; Shift+Enter (o Alt) hace salto de línea.
    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (showQuick && matches[0]) {
        insertQuickReply(matches[0]);
        return;
      }
      if (canSend) onSend();
    }
  }

  return (
    <div style={wrap}>
      {/* Respuesta citada */}
      {replyTo && (
        <div style={quoteBar}>
          <span style={quoteIcon}>
            <NavIcon name="reply" size={14} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={quoteWho}>
              {replyTo.direction === "OUTBOUND" ? "Tú" : "Cliente"}
            </div>
            <div style={quoteText}>
              {replyTo.content || `[${replyTo.type.toLowerCase()}]`}
            </div>
          </div>
          <button onClick={onCancelReply} style={iconBtn} title="Quitar cita">
            <NavIcon name="x" size={14} />
          </button>
        </div>
      )}

      {/* Adjunto pendiente de enviar */}
      {attachment && (
        <div style={quoteBar}>
          <span style={quoteIcon}>
            <NavIcon
              name={attachment.kind === "IMAGE" ? "image" : "file"}
              size={14}
            />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={quoteWho}>{attachment.fileName}</div>
            <div style={quoteText}>
              {attachment.size < 1024 * 1024
                ? `${Math.round(attachment.size / 1024)} KB`
                : `${(attachment.size / 1024 / 1024).toFixed(1)} MB`}
            </div>
          </div>
          <button onClick={onRemoveAttachment} style={iconBtn} title="Quitar">
            <NavIcon name="x" size={14} />
          </button>
        </div>
      )}

      {/* Respuestas rápidas */}
      {showQuick && (
        <div style={quickPanel}>
          <div style={quickHead}>
            <NavIcon name="zap" size={13} />
            Respuestas rápidas
            <span style={{ marginLeft: "auto", opacity: 0.7 }}>
              Enter inserta la primera · Esc cierra
            </span>
          </div>
          {matches.length === 0 ? (
            <div style={quickEmpty}>
              {quickReplies.length === 0
                ? "Aún no tienes respuestas rápidas. Créalas en Ajustes › Respuestas rápidas."
                : "Ninguna respuesta rápida coincide."}
            </div>
          ) : (
            matches.map((q, i) => (
              <button
                key={q.id}
                onClick={() => insertQuickReply(q)}
                style={quickItem(i === 0)}
              >
                <strong style={{ fontSize: 12.5 }}>
                  {q.shortcut} · {q.title}
                  {q.mediaUrl ? " 📎" : ""}
                </strong>
                <span style={quickBody}>{q.body}</span>
              </button>
            ))
          )}
        </div>
      )}

      {emojiOpen && (
        <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />
      )}

      <div style={bar}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAttach(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => setEmojiOpen((v) => !v)}
          title="Emojis"
          style={{
            ...iconBtn,
            color: emojiOpen ? "var(--accent, #25d366)" : "var(--muted)",
          }}
        >
          <NavIcon name="smile" size={18} />
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !!attachment}
          title={attachment ? "Ya hay un archivo adjunto" : "Adjuntar archivo"}
          style={iconBtn}
        >
          <NavIcon name={uploading ? "clock" : "paperclip"} size={18} />
        </button>

        <button
          type="button"
          onClick={onOpenTemplates}
          title="Enviar una plantilla aprobada"
          style={{
            ...iconBtn,
            color: windowOpen ? "var(--muted)" : "var(--accent, #25d366)",
          }}
        >
          <NavIcon name="file" size={18} />
        </button>

        <button
          type="button"
          onClick={onOpenButtons}
          disabled={!windowOpen}
          title={
            windowOpen
              ? "Enviar un mensaje con botones"
              : "Fuera de las 24h solo se pueden enviar plantillas"
          }
          style={iconBtn}
        >
          <NavIcon name="zap" size={18} />
        </button>

        <textarea
          ref={areaRef}
          rows={1}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            attachment
              ? "Añade un pie de foto (opcional)…"
              : "Escribe un mensaje…  «/» para respuestas rápidas"
          }
          style={area}
        />

        <button
          type="button"
          onClick={() => canSend && onSend()}
          disabled={!canSend}
          title="Enviar (Enter)"
          style={sendBtn(canSend)}
        >
          <NavIcon name={sending ? "clock" : "send"} size={17} />
        </button>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: "relative",
  borderTop: "1px solid var(--border)",
  background: "var(--panel, #131a26)",
};

const bar: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 8,
  padding: "10px 16px",
};

const area: React.CSSProperties = {
  flex: 1,
  minHeight: 38,
  maxHeight: 160,
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--field, #0d1320)",
  color: "var(--text)",
  fontSize: 14,
  lineHeight: 1.45,
  fontFamily: "inherit",
  resize: "none",
  overflowY: "auto",
};

const iconBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 38,
  height: 38,
  flexShrink: 0,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  transition: "color 150ms, background 150ms",
};

function sendBtn(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 10,
    border: "none",
    background: active ? "var(--accent, #25d366)" : "var(--field, #0d1320)",
    color: active ? "var(--accent-ink, #04210f)" : "var(--muted)",
    cursor: active ? "pointer" : "default",
    transition: "background 160ms cubic-bezier(0.22,1,0.36,1)",
  };
}

const quoteBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 16px",
  borderTop: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
};

const quoteIcon: React.CSSProperties = {
  color: "var(--accent, #25d366)",
  display: "inline-flex",
  flexShrink: 0,
};

const quoteWho: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--accent, #25d366)",
};

const quoteText: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--muted)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const quickPanel: React.CSSProperties = {
  position: "absolute",
  bottom: "100%",
  left: 16,
  right: 16,
  marginBottom: 8,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface, #131a26)",
  boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
  overflow: "hidden",
  zIndex: 20,
};

const quickHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  fontSize: 11.5,
  fontWeight: 600,
  color: "var(--muted)",
  borderBottom: "1px solid var(--border)",
};

const quickEmpty: React.CSSProperties = {
  padding: "12px",
  fontSize: 12.5,
  color: "var(--muted)",
};

function quickItem(first: boolean): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    width: "100%",
    textAlign: "left",
    padding: "9px 12px",
    border: "none",
    background: first ? "rgba(37,211,102,0.08)" : "transparent",
    color: "var(--text)",
    cursor: "pointer",
  };
}

const quickBody: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
