"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ConversationStatus,
  type ConversationDto,
  type ConversationFilter,
  type ReplyFilter,
} from "@crm/shared";
import { fetchConversations, setConversationStatus } from "@/lib/bff";
import { useInboxSocket } from "@/hooks/useInboxSocket";
import { useInboxNotifications } from "@/hooks/useInboxNotifications";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { NavIcon } from "@/components/NavIcons";
import { useT } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { toast } from "@/lib/toast";
import { ConversationList, ConversationListSkeleton, previewOf } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";

const FILTERS: { key: ConversationFilter; labelKey: MessageKey }[] = [
  { key: "all", labelKey: "inbox.filterAll" },
  { key: "unassigned", labelKey: "inbox.filterUnassigned" },
  { key: "mine", labelKey: "inbox.filterMine" },
];

// "Cualquiera" y no "Todas": el filtro de arriba ya usa esa palabra y dos
// "Todas" seguidas no dejan claro qué apaga cada una.
const REPLY_FILTERS: { key: ReplyFilter; labelKey: MessageKey; dot?: string }[] = [
  { key: "all", labelKey: "inbox.replyAny" },
  { key: "pending", labelKey: "inbox.replyPending", dot: "var(--warning)" },
  { key: "replied", labelKey: "inbox.replyReplied", dot: "var(--accent)" },
];

type StatusFilter = ConversationStatus | "";
type Sort = "recent" | "waiting";

export function Inbox() {
  const t = useT();
  const queryClient = useQueryClient();
  const { connected } = useInboxSocket();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // En móvil solo cabe un panel: la lista o el chat.
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [reply, setReply] = useState<ReplyFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("");
  const [channelId, setChannelId] = useState<string>("");
  const [sort, setSort] = useState<Sort>("recent");
  const [search, setSearch] = useState("");

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", filter, reply, status],
    queryFn: () => fetchConversations(filter, status || undefined, reply),
  });

  // Números presentes en lo cargado, para el filtro por canal.
  const channels = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conversations) {
      if (c.channel) map.set(c.channel.id, c.channel.label ?? c.channel.displayPhoneNumber ?? c.channel.id);
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [conversations]);

  // Búsqueda, canal y orden se aplican sobre lo ya cargado: instantáneo y sin
  // una vuelta al servidor por cada tecla.
  const query = search.trim().toLowerCase();
  const shown = useMemo(() => {
    let list = conversations;
    if (channelId) list = list.filter((c) => c.channel?.id === channelId);
    if (query) {
      list = list.filter(
        (c) =>
          (c.contact.name ?? "").toLowerCase().includes(query) ||
          c.contact.phone.toLowerCase().includes(query) ||
          (c.lastMessage?.text ?? "").toLowerCase().includes(query),
      );
    }
    if (sort === "waiting") {
      // Primero quien más tiempo lleva esperando; después el resto, recientes.
      const ts = (c: ConversationDto) => (c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0);
      list = [...list].sort((a, b) => {
        if (a.awaitingReply !== b.awaitingReply) return a.awaitingReply ? -1 : 1;
        return a.awaitingReply ? ts(a) - ts(b) : ts(b) - ts(a);
      });
    }
    return list;
  }, [conversations, channelId, query, sort]);

  const awaitingCount = useMemo(
    () => conversations.filter((c) => c.awaitingReply).length,
    [conversations],
  );

  // En escritorio se abre la primera; en móvil se espera a que el usuario elija.
  const selected = useMemo(() => {
    const id = selectedId ?? (isMobile ? null : (shown[0]?.id ?? null));
    return shown.find((c) => c.id === id) ?? null;
  }, [shown, selectedId, isMobile]);

  const nombreDe = useCallback((c: ConversationDto) => c.contact.name ?? c.contact.phone, []);
  const previewDe = useCallback((c: ConversationDto) => previewOf(c, t), [t]);
  const notify = useInboxNotifications(conversations, selected?.id ?? null, nombreDe, previewDe);

  function select(c: ConversationDto) {
    setSelectedId(c.id);
    setMobilePane("chat");
  }

  // Cerrar y pasar a la siguiente de la lista: para triar de corrido.
  const closeMut = useMutation({
    mutationFn: (id: string) => setConversationStatus(id, ConversationStatus.CLOSED),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    onError: (e) => toast.error((e as Error).message),
  });
  function closeAndNext() {
    if (!selected) return;
    const i = shown.findIndex((c) => c.id === selected.id);
    const next = shown[i + 1] ?? shown[i - 1] ?? null;
    closeMut.mutate(selected.id);
    if (next) setSelectedId(next.id);
    else {
      setSelectedId(null);
      setMobilePane("list");
    }
  }

  // Atajos: ↑/↓ cambian de conversación, Esc vuelve a la lista en móvil.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!shown.length) return;
        e.preventDefault();
        const i = shown.findIndex((c) => c.id === selected?.id);
        const j = e.key === "ArrowDown" ? Math.min(shown.length - 1, i + 1) : Math.max(0, i - 1);
        const c = shown[j];
        if (c) {
          setSelectedId(c.id);
          document.querySelector(`[data-conversation-id="${c.id}"]`)?.scrollIntoView({ block: "nearest" });
        }
      } else if (e.key === "Escape" && isMobile) {
        setMobilePane("list");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, selected, isMobile]);

  const showList = !isMobile || mobilePane === "list";
  const showChat = !isMobile || mobilePane === "chat";

  return (
    <div className="inbox" style={{ display: "flex", height: "calc(100vh - var(--header-h))" }}>
      {showList && (
        <aside className="inbox-list" style={listPane}>
          <div style={paneHeader}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
              {t("inbox.conversations")}
              {!isLoading && (
                <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 13 }}>
                  · {shown.length}
                  {awaitingCount > 0 && (
                    <span style={{ color: "var(--warning)" }}> · {t("inbox.awaitingCount", { n: awaitingCount })}</span>
                  )}
                </span>
              )}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => (notify.enabled ? notify.disable() : void notify.enable())}
                title={
                  notify.enabled
                    ? t("inbox.notifyOn")
                    : notify.permission === "denied"
                      ? t("inbox.notifyBlocked")
                      : t("inbox.notifyEnable")
                }
                aria-pressed={notify.enabled}
                style={bellBtn(notify.enabled)}
              >
                <NavIcon name={notify.enabled ? "bell" : "bell-off"} size={13} />
              </button>
              {/* El estado no se comunica solo con color: punto + palabra. */}
              <span style={liveChip(connected)}>
                <span style={liveDot(connected)} />
                {connected ? t("inbox.live") : t("inbox.offline")}
              </span>
            </span>
          </div>

          <div style={filterBar}>
            <label style={searchField}>
              <NavIcon name="search" size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("inbox.searchConversations")}
                style={searchInput}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  title={t("common.close")}
                  aria-label={t("common.close")}
                  style={clearBtn}
                >
                  <NavIcon name="x" size={13} />
                </button>
              )}
            </label>

            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {FILTERS.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={chip(filter === f.key)}>
                  {t(f.labelKey)}
                </button>
              ))}
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setSort((s) => (s === "recent" ? "waiting" : "recent"))}
                title={sort === "recent" ? t("inbox.sortWaiting") : t("inbox.sortRecent")}
                style={chip(sort === "waiting")}
              >
                <NavIcon name="hourglass" size={11} />
                {sort === "waiting" ? t("inbox.sortWaitingShort") : t("inbox.sortRecentShort")}
              </button>
            </div>

            <ReplySwitch value={reply} onChange={setReply} />

            <div style={{ display: "flex", gap: 6 }}>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                aria-label={t("inbox.status")}
                style={{ ...statusSelect, flex: 1 }}
              >
                <option value="">{t("inbox.statusAll")}</option>
                <option value={ConversationStatus.OPEN}>{t("inbox.statusOpen")}</option>
                <option value={ConversationStatus.PENDING}>{t("inbox.statusPending")}</option>
                <option value={ConversationStatus.CLOSED}>{t("inbox.statusClosed")}</option>
              </select>
              {channels.length > 1 && (
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  aria-label={t("inbox.channelFilter")}
                  style={{ ...statusSelect, flex: 1 }}
                >
                  <option value="">{t("inbox.allChannels")}</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {isLoading ? (
              <ConversationListSkeleton />
            ) : (
              <ConversationList
                conversations={shown}
                selectedId={selected?.id ?? null}
                onSelect={select}
                emptyMessage={query ? t("inbox.noMatches", { query: search.trim() }) : undefined}
              />
            )}
          </div>
        </aside>
      )}

      {showChat && (
        <main className="inbox-chat" style={{ flex: 1, minWidth: 0 }}>
          {selected ? (
            <ChatWindow
              key={selected.id}
              conversation={selected}
              onBack={isMobile ? () => setMobilePane("list") : undefined}
              onCloseAndNext={closeAndNext}
            />
          ) : (
            <div style={emptyPane}>
              <NavIcon name="inbox" size={30} />
              <p style={{ margin: "12px 0 0", fontWeight: 600 }}>{t("inbox.selectConversation")}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>{t("inbox.selectConversationHint")}</p>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

// Switch segmentado para el filtro de respuesta (Cualquiera / Sin responder /
// Respondidas) con indicador deslizante.
function ReplySwitch({ value, onChange }: { value: ReplyFilter; onChange: (v: ReplyFilter) => void }) {
  const t = useT();
  const index = REPLY_FILTERS.findIndex((f) => f.key === value);

  return (
    <div style={switchTrack} role="tablist" aria-label={t("inbox.replyFilterLabel")}>
      <span aria-hidden style={{ ...switchThumb, transform: `translateX(${index * 100}%)` }} />
      {REPLY_FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <button key={f.key} role="tab" aria-selected={active} onClick={() => onChange(f.key)} style={switchSeg(active)}>
            {f.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: f.dot, flexShrink: 0 }} />}
            {t(f.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────

const switchTrack: React.CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: `repeat(${REPLY_FILTERS.length}, 1fr)`,
  padding: 3,
  borderRadius: 999,
  background: "var(--field)",
  border: "1px solid var(--border)",
};

const switchThumb: React.CSSProperties = {
  position: "absolute",
  top: 3,
  left: 3,
  width: `calc((100% - 6px) / ${REPLY_FILTERS.length})`,
  height: "calc(100% - 6px)",
  borderRadius: 999,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
  transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1)",
  pointerEvents: "none",
};

function switchSeg(active: boolean): React.CSSProperties {
  return {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: "6px 8px",
    borderRadius: 999,
    border: "none",
    background: "transparent",
    color: active ? "var(--text)" : "var(--muted)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "color 0.18s ease",
  };
}

const listPane: React.CSSProperties = {
  width: 360,
  borderRight: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  minWidth: 0,
};

const paneHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "14px 14px 12px 16px",
  borderBottom: "1px solid var(--border)",
  fontWeight: 600,
};

function bellBtn(on: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 22,
    borderRadius: 999,
    border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
    background: on ? "var(--accent-soft)" : "transparent",
    color: on ? "var(--accent)" : "var(--muted)",
    cursor: "pointer",
    padding: 0,
  };
}

function liveChip(connected: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    color: connected ? "var(--positive)" : "var(--muted)",
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    flexShrink: 0,
  };
}

function liveDot(connected: boolean): React.CSSProperties {
  return {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: connected ? "var(--positive)" : "#7a8aa0",
    flexShrink: 0,
  };
}

const filterBar: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 12px",
  borderBottom: "1px solid var(--border)",
};

const searchField: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--field)",
  color: "var(--muted)",
};

const searchInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  background: "transparent",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
};

const clearBtn: React.CSSProperties = {
  display: "inline-flex",
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  padding: 0,
};

function chip(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: active ? "var(--accent)" : "transparent",
    color: active ? "var(--accent-ink)" : "var(--muted)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

const statusSelect: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--field)",
  color: "var(--text)",
  fontSize: 13,
  minWidth: 0,
};

const emptyPane: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "var(--muted)",
  textAlign: "center",
  padding: 24,
};
