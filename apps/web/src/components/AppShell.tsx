import Link from "next/link";
import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { readSessionCookie, revokeRefreshToken } from "@/lib/session-token";
import { NavIcon } from "./NavIcons";
import { SideNav, type NavKey } from "./SideNav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getTranslator } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";

export type { NavKey };

// Cada pantalla toma su título del diccionario; la clave es la misma que su
// entrada en el menú.
const TITLE_KEYS: Record<NavKey, string> = {
  inbox: "inbox",
  contacts: "contacts",
  pipeline: "pipeline",
  products: "products",
  bots: "agents",
  flows: "flows",
  campaigns: "broadcasts",
  sellers: "sellers",
  knowledge: "knowledge",
  whatsapp: "whatsapp",
  sessions: "sessions",
  account: "account",
  settings: "settings",
};

export async function AppShell({
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
  const t = await getTranslator();
  const page = TITLE_KEYS[active];
  // La preferencia del menú se lee en el servidor: así se pinta ya plegado,
  // sin el salto de verlo ancho un instante.
  const collapsed = (await cookies()).get("sidebar-collapsed")?.value === "1";

  return (
    <div style={shell}>
<<<<<<< HEAD
      <aside style={sidebar}>
        <div style={brand}>
          <span style={brandMark}>P</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Trimmo</span>
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
=======
      <SideNav role={role} active={active} initialCollapsed={collapsed} />
>>>>>>> 2da1df078dfaeb0e81b9d1a84182da2d2c7e8417

      <div style={main}>
        <header style={topbar}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {t(`pages.${page}.title` as MessageKey)}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              {t(`pages.${page}.subtitle` as MessageKey)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LanguageSwitcher />
            <Link
              href="/account"
              className="user-chip"
              style={{ ...userChip, color: "var(--text)" }}
              title={t("nav.myAccount")}
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
                // Revoca también la sesión en el backend: si no, seguiría
                // activa (y listada en Sesiones) hasta que caducara.
                const current = await readSessionCookie(await cookies());
                await revokeRefreshToken(current?.token.refreshToken);
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="icon-btn" title={t("nav.logout")}>
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
