import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { currentOrgContext, currentOrgSlug } from "@/lib/org";
import { OrgNotFound } from "./OrgNotFound";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");
  const { error } = await searchParams;

  // Empresa del subdominio. Con DNS comodín cualquier subdominio responde, así
  // que hay que distinguir "no hay subdominio" de "subdominio que no existe".
  const ctx = await currentOrgContext();
  const baseDomain = process.env.SAAS_BASE_DOMAIN ?? "localhost:3000";
  const org = ctx.kind === "found" ? ctx.org : null;
  // Hay dominio base configurado = instalación SaaS con subdominios.
  const esSaaS = !!process.env.SAAS_BASE_DOMAIN;

  async function login(formData: FormData) {
    "use server";
    try {
      // El subdominio se lee del servidor, no del formulario: así no depende de
      // un campo oculto que cualquiera puede cambiar en el navegador.
      const orgSlug = await currentOrgSlug();
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        ...(orgSlug ? { orgSlug } : {}),
        redirectTo: "/",
      });
    } catch (e) {
      // signIn lanza NEXT_REDIRECT al tener éxito (hay que re-lanzarlo).
      // Si las credenciales fallan, lanza AuthError → volvemos con error.
      if (e instanceof AuthError) {
        redirect("/login?error=credentials");
      }
      throw e;
    }
  }

  if (ctx.kind === "unknown") {
    return (
      <main
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          padding: 24,
        }}
      >
        <OrgNotFound slug={ctx.slug} baseDomain={baseDomain} />
      </main>
    );
  }

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <form action={login} style={card}>
        <h1 style={{ marginTop: 0 }}>{org?.name ?? "Trimmo"}</h1>
        <p style={{ color: "var(--muted)", marginTop: -8 }}>
          {org ? `Acceso de ${org.name}` : "Inicia sesión"}
        </p>

        {error && (
          <p role="alert" style={{ color: "#e08a8a" }}>
            {error === "handoff"
              ? "El pase para entrar ha caducado. Entra con tu correo y la contraseña que elegiste."
              : "Credenciales inválidas."}
          </p>
        )}

        <label style={label}>Email</label>
        <input
          name="email"
          type="email"
          required
          placeholder="tucorreo@empresa.com"
          style={input}
        />

        <label style={label}>Contraseña</label>
        <input name="password" type="password" required style={input} />

        <button type="submit" style={btn}>
          Entrar
        </button>

        {/*
          Qué se ofrece debajo del formulario depende de dónde estés:

          · Dentro del subdominio de una empresa, NO se ofrece registrarse. Si
            se ofreciera, cualquiera que supiera el subdominio podría meterse
            en la lista de usuarios de esa empresa. Se entra por invitación.
          · En el dominio principal, lo que se crea es una EMPRESA, no un
            usuario suelto.
          · Con una sola empresa (open source), todo sigue como siempre.
        */}
        {org ? (
          <p style={pieTexto}>
            ¿Necesitas acceso? Pídeselo a quien administra {org.name}.
          </p>
        ) : esSaaS ? (
          <p style={pieTexto}>
            ¿Tu empresa aún no está aquí?{" "}
            <Link href="/signup" style={{ color: "var(--accent)" }}>
              Créala en un minuto
            </Link>
          </p>
        ) : (
          <p style={pieTexto}>
            ¿No tienes cuenta?{" "}
            <Link href="/register" style={{ color: "var(--accent)" }}>
              Regístrate
            </Link>
          </p>
        )}
      </form>
    </main>
  );
}

const card: React.CSSProperties = {
  width: 360,
  padding: 28,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  display: "flex",
  flexDirection: "column",
};

const label: React.CSSProperties = {
  fontSize: 13,
  color: "var(--muted)",
  marginTop: 14,
  marginBottom: 6,
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
};

const btn: React.CSSProperties = {
  marginTop: 22,
  padding: "11px 14px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  fontWeight: 600,
  cursor: "pointer",
};

const pieTexto: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
  marginTop: 18,
  textAlign: "center",
};
