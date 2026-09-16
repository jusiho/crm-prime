"use client";

import { useState } from "react";
import Link from "next/link";
import { NavIcon, type IconName } from "./NavIcons";

export type NavKey =
  | "inbox"
  | "contacts"
  | "pipeline"
  | "products"
  | "bots"
  | "flows"
  | "campaigns"
  | "sellers"
  | "knowledge"
  | "whatsapp"
  | "sessions"
  | "account"
  | "settings";

type Item = {
  key: NavKey;
  href: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
};
type Group = { label: string; items: Item[] };

const NAV: Group[] = [
  {
    label: "Ventas",
    items: [
      { key: "inbox", href: "/", label: "Bandeja", icon: "inbox" },
      { key: "contacts", href: "/contacts", label: "Contactos", icon: "user" },
      { key: "pipeline", href: "/pipeline", label: "Pipeline", icon: "pipeline" },
      { key: "products", href: "/products", label: "Productos", icon: "tag" },
    ],
  },
  {
    label: "Automatización",
    items: [
      { key: "bots", href: "/bots", label: "Bots IA", icon: "bot" },
      { key: "flows", href: "/flows", label: "Flujos", icon: "flow" },
      { key: "campaigns", href: "/difusiones", label: "Difusiones", icon: "megaphone" },
    ],
  },
  {
    label: "Equipo",
    items: [
      {
        key: "sellers",
        href: "/sellers",
        label: "Vendedores",
        icon: "user",
        adminOnly: true,
      },
    ],
  },
  {
    label: "Recursos",
    items: [
      { key: "knowledge", href: "/knowledge", label: "Conocimiento", icon: "book" },
      { key: "whatsapp", href: "/whatsapp", label: "WhatsApp", icon: "whatsapp" },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        key: "settings",
        href: "/settings",
        label: "Ajustes",
        icon: "settings",
        adminOnly: true,
      },
    ],
  },
];

const COOKIE = "sidebar-collapsed";

/**
 * Menú lateral plegable. El estado se guarda en una cookie (no en
 * localStorage) para que el servidor ya lo sepa al pintar: así no se ve el
 * menú ancho un instante antes de plegarse.
 */
export function SideNav({
  role,
  active,
  initialCollapsed,
}: {
  role?: string;
  active: NavKey;
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // Un año: es una preferencia, no un dato de sesión.
    document.cookie = `${COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside style={{ ...sidebar, width: collapsed ? 64 : "var(--sidebar-w)" }}>
      <div style={{ ...brand, justifyContent: collapsed ? "center" : "space-between" }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={brandMark}>P</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>CRM Prime</span>
          </div>
        )}
        <button
          onClick={toggle}
          className="icon-btn"
          style={toggleBtn}
          title={collapsed ? "Desplegar menú" : "Plegar menú"}
          aria-label={collapsed ? "Desplegar menú" : "Plegar menú"}
          aria-expanded={!collapsed}
        >
          <span
            style={{
              display: "flex",
              transform: collapsed ? "rotate(180deg)" : undefined,
            }}
          >
            <NavIcon name="arrow-left" size={16} />
          </span>
        </button>
      </div>

      <nav style={{ padding: collapsed ? "8px 8px" : "4px 10px", overflowY: "auto", flex: 1 }}>
        {NAV.map((group) => {
          const items = group.items.filter(
            (it) => !it.adminOnly || role === "ADMIN",
          );
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              {collapsed ? (
                <div style={groupSeparator} />
              ) : (
                <div className="nav-group">{group.label}</div>
              )}
              {items.map((it) => (
                <Link
                  key={it.key}
                  href={it.href}
                  className={`nav-item${active === it.key ? " active" : ""}`}
                  style={collapsed ? collapsedItem : undefined}
                  title={collapsed ? it.label : undefined}
                >
                  <NavIcon name={it.icon} />
                  {!collapsed && it.label}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

const sidebar: React.CSSProperties = {
  flexShrink: 0,
  background: "var(--sidebar)",
  borderRight: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  transition: "width 0.16s ease",
};

const brand: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  height: "var(--header-h)",
  padding: "0 12px",
  borderBottom: "1px solid var(--border)",
};

const brandMark: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "var(--accent)",
  color: "#f3f8ff",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
  flexShrink: 0,
};

const toggleBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
};

const collapsedItem: React.CSSProperties = {
  justifyContent: "center",
  padding: "10px 0",
};

const groupSeparator: React.CSSProperties = {
  height: 1,
  background: "var(--border)",
  margin: "8px 6px",
};
