import Link from "next/link";
import { signOut } from "@/auth";
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
      { key: "campaigns", href: "/campaigns", label: "Campañas", icon: "megaphone" },
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

const TITLES: Record<NavKey, { title: string; subtitle: string }> = {
  inbox: { title: "Bandeja", subtitle: "Conversaciones en tiempo real" },
  contacts: { title: "Contactos", subtitle: "Directorio de clientes y leads" },
  pipeline: { title: "Pipeline", subtitle: "Embudo de ventas y deals" },
  products: { title: "Productos", subtitle: "Catálogo de productos y servicios" },
  bots: { title: "Bots IA", subtitle: "Agentes que responden por ti" },
  flows: { title: "Flujos", subtitle: "Automatiza conversaciones paso a paso" },
  campaigns: { title: "Campañas", subtitle: "Envíos masivos y broadcasts" },
  sellers: { title: "Vendedores", subtitle: "Fuentes y asignación de leads" },
  knowledge: { title: "Conocimiento", subtitle: "Base de conocimiento para la IA" },
  whatsapp: { title: "WhatsApp", subtitle: "Conecta y gestiona tus números" },
  sessions: { title: "Sesiones", subtitle: "Dispositivos con tu cuenta abierta" },
  account: { title: "Mi cuenta", subtitle: "Perfil, contraseña y seguridad" },
  settings: { title: "Ajustes", subtitle: "Etiquetas, canales, fuentes y más" },
};

export function AppShell({
  email,
  role,
  active,
  children,
}: {
  email: string;
  role?: string;
  active: NavKey;
  children: React.ReactNode;
}) {
  const head = TITLES[active];

  return (
    <div style={shell}>
      <aside style={sidebar}>
        <div style={brand}>
          <span style={brandMark}>P</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>CRM Prime</span>
        </div>

        <nav style={{ padding: "4px 10px", overflowY: "auto", flex: 1 }}>
          {NAV.map((group) => {
            const items = group.items.filter(
              (it) => !it.adminOnly || role === "ADMIN",
            );
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <div className="nav-group">{group.label}</div>
                {items.map((it) => (
                  <Link
                    key={it.key}
                    href={it.href}
                    className={`nav-item${active === it.key ? " active" : ""}`}
                  >
                    <NavIcon name={it.icon} />
                    {it.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <div style={main}>
        <header style={topbar}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{head.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              {head.subtitle}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href="/account"
              className="user-chip"
              style={{ ...userChip, color: "var(--text)" }}
              title="Mi cuenta"
            >
              <span style={avatar}>{(email[0] ?? "?").toUpperCase()}</span>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 13 }}>{email}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{role}</div>
              </div>
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="icon-btn" title="Salir">
                <NavIcon name="logout" />
              </button>
            </form>
          </div>
        </header>

        <div className="app-content" style={content}>{children}</div>
      </div>
    </div>
  );
}

const shell: React.CSSProperties = {
  display: "flex",
  height: "100vh",
  overflow: "hidden",
};

const sidebar: React.CSSProperties = {
  width: "var(--sidebar-w)",
  flexShrink: 0,
  background: "var(--sidebar)",
  borderRight: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
};

const brand: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  height: "var(--header-h)",
  padding: "0 16px",
  borderBottom: "1px solid var(--border)",
};

const brandMark: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "var(--accent)",
  color: "#f3f8ff",
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 15,
};

const main: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
};

const topbar: React.CSSProperties = {
  height: "var(--header-h)",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 20px",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg)",
  // La cabecera flota una pizca sobre el contenido que hace scroll bajo ella.
  boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
  zIndex: 1,
};

const content: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
};

const userChip: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "4px 6px",
  borderRadius: 9,
  transition: "background 0.12s ease",
};

const avatar: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "#22304a",
  color: "#cfe0ff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 700,
};
