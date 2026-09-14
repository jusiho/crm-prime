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
import { ConversationList, ConversationListSkeleton } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";

const FILTERS: { key: ConversationFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "unassigned", label: "Sin asignar" },
  { key: "mine", label: "Mías" },
];

const REPLY_FILTERS: { key: ReplyFilter; label: string; dot?: string }[] = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Sin responder", dot: "var(--warning)" },
  { key: "replied", label: "Respondidas", dot: "var(--accent)" },
];

type StatusFilter = ConversationStatus | "";

export function Inbox() {
  const { connected } = useInboxSocket();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [reply, setReply] = useState<ReplyFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("");

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", filter, reply, status],
    queryFn: () => fetchConversations(filter, status || undefined, reply),
  });

  const selected = useMemo(() => {
    const id = selectedId ?? conversations[0]?.id ?? null;
    return conversations.find((c) => c.id === id) ?? null;
  }, [conversations, selectedId]);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>
      <aside style={listPane}>
        <div style={paneHeader}>
          <span>Conversaciones</span>
          <span
            title={connected ? "En tiempo real" : "Desconectado"}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: connected ? "var(--accent)" : "#7a8aa0",
            }}
          />
        </div>

        <div style={filterBar}>
          <div style={{ display: "flex", gap: 4 }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={chip(filter === f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <ReplySwitch value={reply} onChange={setReply} />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            style={statusSelect}
          >
            <option value="">Todos los estados</option>
            <option value={ConversationStatus.OPEN}>Abierta</option>
            <option value={ConversationStatus.PENDING}>Pendiente</option>
            <option value={ConversationStatus.CLOSED}>Cerrada</option>
          </select>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {isLoading ? (
            <ConversationListSkeleton />
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selected?.id ?? null}
              onSelect={(c) => setSelectedId(c.id)}
            />
          )}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>
        {selected ? (
          <ChatWindow key={selected.id} conversation={selected} />
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--muted)" }}>
            Selecciona una conversación
          </div>
        )}
      </main>
    </div>
  );
}

// Switch segmentado para el filtro de respuesta (Todas / Sin responder /
// Respondidas) con indicador deslizante.
function ReplySwitch({
  value,
  onChange,
}: {
  value: ReplyFilter;
  onChange: (v: ReplyFilter) => void;
}) {
  const index = REPLY_FILTERS.findIndex((f) => f.key === value);

  return (
    <div style={switchTrack} role="tablist" aria-label="Filtrar por respuesta">
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
            {f.label}
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
    padding: "6px 10px",
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
  padding: "16px",
  borderBottom: "1px solid var(--border)",
  fontWeight: 600,
};

const filterBar: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 12px",
  borderBottom: "1px solid var(--border)",
};

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "#f3f8ff" : "var(--muted)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

const statusSelect: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 13,
};
