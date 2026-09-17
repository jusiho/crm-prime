"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ConversationStatus,
  type ConversationFilter,
  type ReplyFilter,
} from "@crm/shared";
import { fetchConversations } from "@/lib/bff";
import { useInboxSocket } from "@/hooks/useInboxSocket";
import { NavIcon } from "@/components/NavIcons";
import { useT } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { ConversationList, ConversationListSkeleton } from "./ConversationList";
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

export function Inbox() {
  const t = useT();
  const { connected } = useInboxSocket();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [reply, setReply] = useState<ReplyFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("");
  const [search, setSearch] = useState("");

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", filter, reply, status],
    queryFn: () => fetchConversations(filter, status || undefined, reply),
  });

  // La búsqueda se aplica sobre lo ya cargado: es instantánea y no gasta una
  // vuelta al servidor por cada tecla.
  const query = search.trim().toLowerCase();
  const shown = useMemo(() => {
    if (!query) return conversations;
    return conversations.filter(
      (c) =>
        (c.contact.name ?? "").toLowerCase().includes(query) ||
        c.contact.phone.toLowerCase().includes(query),
    );
  }, [conversations, query]);

  const selected = useMemo(() => {
    const id = selectedId ?? shown[0]?.id ?? null;
    return shown.find((c) => c.id === id) ?? null;
  }, [shown, selectedId]);

  return (
    <div style={{ display: "flex", height: "calc(100vh - var(--header-h))" }}>
      <aside style={listPane}>
        <div style={paneHeader}>
          <span>
            {t("inbox.conversations")}
            {!isLoading && (
              <span style={{ color: "var(--muted)", fontWeight: 500 }}>
                {" "}
                · {shown.length}
              </span>
            )}
          </span>
          {/* El estado no se comunica solo con color: punto + palabra, para
              quien no distingue el verde del gris. */}
          <span style={liveChip(connected)}>
            <span style={liveDot(connected)} />
            {connected ? t("inbox.live") : t("inbox.offline")}
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

          <div style={{ display: "flex", gap: 4 }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={chip(filter === f.key)}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>

          <ReplySwitch value={reply} onChange={setReply} />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            aria-label={t("inbox.status")}
            style={statusSelect}
          >
            <option value="">{t("inbox.statusAll")}</option>
            <option value={ConversationStatus.OPEN}>{t("inbox.statusOpen")}</option>
            <option value={ConversationStatus.PENDING}>
              {t("inbox.statusPending")}
            </option>
            <option value={ConversationStatus.CLOSED}>
              {t("inbox.statusClosed")}
            </option>
          </select>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {isLoading ? (
            <ConversationListSkeleton />
          ) : (
            <ConversationList
              conversations={shown}
              selectedId={selected?.id ?? null}
              onSelect={(c) => setSelectedId(c.id)}
              emptyMessage={
                query ? t("inbox.noMatches", { query: search.trim() }) : undefined
              }
            />
          )}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>
        {selected ? (
          <ChatWindow key={selected.id} conversation={selected} />
        ) : (
          <div style={emptyPane}>
            <NavIcon name="inbox" size={30} />
            <p style={{ margin: "12px 0 0", fontWeight: 600 }}>
              {t("inbox.selectConversation")}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>
              {t("inbox.selectConversationHint")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// Switch segmentado para el filtro de respuesta (Cualquiera / Sin responder /
// Respondidas) con indicador deslizante.
function ReplySwitch({
  value,
  onChange,
}: {
  value: ReplyFilter;
  onChange: (v: ReplyFilter) => void;
}) {
  const t = useT();
  const index = REPLY_FILTERS.findIndex((f) => f.key === value);

  return (
    <div style={switchTrack} role="tablist" aria-label={t("inbox.replyFilterLabel")}>
      <span
        aria-hidden
        style={{
          ...switchThumb,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {REPLY_FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <button
            key={f.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(f.key)}
            style={switchSeg(active)}
          >
            {f.dot && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: f.dot,
                  flexShrink: 0,
                }}
              />
            )}
            {t(f.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

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
  width: 340,
  borderRight: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
};

const paneHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "16px",
  borderBottom: "1px solid var(--border)",
  fontWeight: 600,
};

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
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "var(--accent-ink)" : "var(--muted)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

const statusSelect: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--field)",
  color: "var(--text)",
  fontSize: 13,
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
