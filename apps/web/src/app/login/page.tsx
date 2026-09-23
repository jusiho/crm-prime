import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { currentOrg, currentOrgSlug } from "@/lib/org";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");
  const { error } = await searchParams;

  // Empresa del subdominio. Null en una instalación de una sola empresa, o si
  // alguien entra por el dominio principal.
  const org = await currentOrg();

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
          <p style={{ color: "#ff6b6b" }}>Credenciales inválidas.</p>
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

        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 18, textAlign: "center" }}>
          ¿No tienes cuenta?{" "}
          <Link href="/register" style={{ color: "var(--accent)" }}>
            Regístrate
          </Link>
        </p>
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
