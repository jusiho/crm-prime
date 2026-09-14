"use client";

import type { ConversationDto } from "@crm/shared";

function initials(name: string | null, phone: string): string {
  if (name) return name.slice(0, 2).toUpperCase();
  return phone.slice(-2);
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: ConversationDto[];
  selectedId: string | null;
  onSelect: (c: ConversationDto) => void;
}) {
  if (conversations.length === 0) {
    return (
      <p style={{ color: "var(--muted)", padding: 16, fontSize: 14 }}>
        Sin conversaciones todavía.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {conversations.map((c) => {
        const active = c.id === selectedId;
        return (
          <li
            key={c.id}
            onClick={() => onSelect(c)}
            className={`conv-item${active ? " is-active" : ""}`}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: "12px 16px",
              cursor: "pointer",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={avatar}>{initials(c.contact.name, c.contact.phone)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong
                  style={{
                    ...ellipsis,
                    fontWeight: c.awaitingReply ? 700 : 600,
                  }}
                >
                  {c.contact.name ?? c.contact.phone}
                </strong>
                <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {c.awaitingReply && (
                    <span
                      title="Sin responder"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--warning)",
                        boxShadow: "0 0 0 3px color-mix(in srgb, var(--warning) 22%, transparent)",
                      }}
                    />
                  )}
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                    {timeAgo(c.lastMessageAt)}
                  </span>
                </span>
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {c.contact.phone}
                {!c.windowOpen && (
                  <span style={{ color: "#e0a458", marginLeft: 8 }}>
                    · cerrada 24h
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                {c.aiMode === "AUTOPILOT" && (
                  <span style={badge("#1f6f46")}>🤖 auto</span>
                )}
                {c.aiMode === "COPILOT" && (
                  <span style={badge("#2c4b7a")}>🤖 copilot</span>
                )}
                {c.status !== "OPEN" && (
                  <span style={badge(c.status === "PENDING" ? "#caa14a" : "#7a8aa0")}>
                    {c.status === "PENDING" ? "pendiente" : "cerrada"}
                  </span>
                )}
                <span style={badge(c.assignedAgent ? "#3a5f9d" : "#43506a")}>
                  {c.assignedAgent
                    ? (c.assignedAgent.name ?? "asignado")
                    : "sin asignar"}
                </span>
                {c.channel && (
                  <span style={badge("#1f5a6f")}>
                    📱 {c.channel.label ?? c.channel.displayPhoneNumber}
                  </span>
                )}
                {c.contact.tags.map((t) => (
                  <span key={t.name} style={badge(tagColor(t.color))}>
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ConversationListSkeleton() {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            className="skeleton"
            style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="skeleton" style={{ height: 12, width: "55%" }} />
            <div className="skeleton" style={{ height: 10, width: "75%", opacity: 0.7 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function tagColor(color: string | null): string {
  if (color && /^#?[0-9a-fA-F]{3,8}$/.test(color)) {
    return color.startsWith("#") ? color : `#${color}`;
  }
  return "#2c4b7a";
}

function badge(bg: string): React.CSSProperties {
  return {
    fontSize: 10,
    padding: "1px 7px",
    borderRadius: 999,
    background: bg,
    color: "#e9f1ff",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  };
}

const avatar: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  background: "#1f3a6b",
  color: "#dbe7ff",
  display: "grid",
  placeItems: "center",
  fontSize: 14,
  fontWeight: 600,
  flexShrink: 0,
};

const ellipsis: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
