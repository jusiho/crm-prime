import Link from "next/link";
import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { readSessionCookie, revokeRefreshToken } from "@/lib/session-token";
import { NavIcon } from "./NavIcons";
import { SideNav, type NavKey } from "./SideNav";

export type { NavKey };

const TITLES: Record<NavKey, { title: string; subtitle: string }> = {
  inbox: { title: "Bandeja", subtitle: "Conversaciones en tiempo real" },
  contacts: { title: "Contactos", subtitle: "Directorio de clientes y leads" },
  pipeline: { title: "Pipeline", subtitle: "Embudo de ventas y deals" },
  products: { title: "Productos", subtitle: "Catálogo de productos y servicios" },
  bots: { title: "Bots IA", subtitle: "Agentes que responden por ti" },
  flows: { title: "Flujos", subtitle: "Automatiza conversaciones paso a paso" },
  campaigns: { title: "Difusiones", subtitle: "Envíos masivos a tus contactos" },
  sellers: { title: "Vendedores", subtitle: "Fuentes y asignación de leads" },
  knowledge: { title: "Conocimiento", subtitle: "Base de conocimiento para la IA" },
  whatsapp: { title: "WhatsApp", subtitle: "Conecta y gestiona tus números" },
  sessions: { title: "Sesiones", subtitle: "Dispositivos con tu cuenta abierta" },
  account: { title: "Mi cuenta", subtitle: "Perfil, contraseña y seguridad" },
  settings: { title: "Ajustes", subtitle: "Etiquetas, canales, fuentes y más" },
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
  const head = TITLES[active];
  // La preferencia del menú se lee en el servidor: así se pinta ya plegado,
  // sin el salto de verlo ancho un instante.
  const collapsed = (await cookies()).get("sidebar-collapsed")?.value === "1";

  return (
    <div style={shell}>
      <SideNav role={role} active={active} initialCollapsed={collapsed} />

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
                // Revoca también la sesión en el backend: si no, seguiría
                // activa (y listada en Sesiones) hasta que caducara.
                const current = await readSessionCookie(await cookies());
                await revokeRefreshToken(current?.token.refreshToken);
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
