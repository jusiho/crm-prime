"use client";

import type { ConversationDto } from "@crm/shared";
import { NavIcon } from "@/components/NavIcons";
import { useT } from "@/i18n/I18nProvider";
import type { Translator } from "@/i18n/translate";

/** Iniciales del contacto: dos palabras si las hay, si no los últimos dígitos. */
function initials(name: string | null, phone: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return phone.replace(/\D/g, "").slice(-2);
}

function timeAgo(iso: string | null, t: Translator): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("inbox.timeNow");
  if (m < 60) return t("inbox.timeMinutes", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("inbox.timeHours", { n: h });
  return t("inbox.timeDays", { n: Math.floor(h / 24) });
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  emptyMessage,
}: {
  conversations: ConversationDto[];
  selectedId: string | null;
  onSelect: (c: ConversationDto) => void;
  emptyMessage?: string;
}) {
  const t = useT();

  if (conversations.length === 0) {
    return (
      <p style={{ color: "var(--muted)", padding: 16, fontSize: 14 }}>
        {emptyMessage ?? t("inbox.noConversations")}
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
              alignItems: "flex-start",
              padding: "12px 16px",
              cursor: "pointer",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={avatar}>{initials(c.contact.name, c.contact.phone)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={topRow}>
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
                    <span title={t("inbox.awaitingReply")} style={pendingDot} />
                  )}
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                    {timeAgo(c.lastMessageAt, t)}
                  </span>
                </span>
              </div>

              <div style={{ color: "var(--muted)", fontSize: 13, ...ellipsis }}>
                {c.contact.phone}
              </div>

              <div style={badgeRow}>
                {/* Una conversación fuera de las 24 h no admite texto libre:
                    es lo primero que hay que saber antes de abrirla. */}
                {!c.windowOpen && (
                  <span
                    style={{
                      ...badgeOutline,
                      color: "var(--warning)",
                      borderColor: "var(--warning)",
                    }}
                  >
                    <NavIcon name="hourglass" size={10} />
                    {t("inbox.windowClosedShort")}
                  </span>
                )}
                {c.aiMode === "AUTOPILOT" && (
                  <span style={badgeAccent}>
                    <NavIcon name="bot" size={10} />
                    {t("inbox.modeAuto")}
                  </span>
                )}
                {c.aiMode === "COPILOT" && (
                  <span style={badgeOutline}>
                    <NavIcon name="bot" size={10} />
                    {t("inbox.modeCopilot")}
                  </span>
                )}
                {c.status !== "OPEN" && (
                  <span style={badgeOutline}>
                    {c.status === "PENDING"
                      ? t("inbox.statusPending")
                      : t("inbox.statusClosed")}
                  </span>
                )}
                <span style={badgeOutline}>
                  <NavIcon name="user" size={10} />
                  {c.assignedAgent?.name ?? t("inbox.unassigned")}
                </span>
                {c.channel && (
                  <span style={badgeOutline}>
                    <NavIcon name="phone" size={10} />
                    {c.channel.label ?? c.channel.displayPhoneNumber}
                  </span>
                )}
                {c.contact.tags.map((tag) => (
                  <span key={tag.name} style={badgeTag(tag.color)}>
                    {tag.name}
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

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const pendingDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "var(--warning)",
  boxShadow: "0 0 0 3px var(--warning-soft)",
};

const badgeRow: React.CSSProperties = {
  display: "flex",
  gap: 5,
  marginTop: 6,
  flexWrap: "wrap",
  alignItems: "center",
};

// Base común: los distintivos secundarios van en contorno para que los únicos
// rellenos —las etiquetas del contacto y el autopilot— destaquen de verdad.
const badgeBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 10,
  padding: "1px 7px",
  borderRadius: 999,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  whiteSpace: "nowrap",
  maxWidth: 150,
  overflow: "hidden",
};

const badgeOutline: React.CSSProperties = {
  ...badgeBase,
  border: "1px solid var(--border)",
  color: "var(--muted)",
};

const badgeAccent: React.CSSProperties = {
  ...badgeBase,
  border: "1px solid transparent",
  background: "var(--accent-soft)",
  color: "#9dc0ff",
};

function badgeTag(color: string | null): React.CSSProperties {
  const bg =
    color && /^#?[0-9a-fA-F]{3,8}$/.test(color)
      ? color.startsWith("#")
        ? color
        : `#${color}`
      : "#2c4b7a";
  return {
    ...badgeBase,
    border: "1px solid transparent",
    background: bg,
    color: "#eaf2ff",
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
