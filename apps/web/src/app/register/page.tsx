import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { PasswordField } from "@/components/PasswordField";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");
  // En SaaS no hay usuarios sueltos: se crea una empresa, o te invita la tuya.
  if (process.env.SAAS_BASE_DOMAIN) redirect("/signup");
  const { error } = await searchParams;

  async function register(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { message?: string | string[] }
        | null;
      const msg = Array.isArray(body?.message)
        ? body?.message.join(", ")
        : (body?.message ?? "No se pudo registrar");
      redirect(`/register?error=${encodeURIComponent(msg)}`);
    }

    // Registro correcto → iniciar sesión automáticamente.
    try {
      await signIn("credentials", { email, password, redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) {
        redirect("/login?error=credentials");
      }
      throw e;
    }
  }

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
      <form action={register} style={card}>
        <h1 style={{ marginTop: 0 }}>Crear cuenta</h1>
        <p style={{ color: "var(--muted)", marginTop: -8 }}>
          Regístrate para acceder al CRM
        </p>

        {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}

        <label style={label}>Nombre</label>
        <input name="name" type="text" required placeholder="Tu nombre" style={input} />

        <label style={label}>Email</label>
        <input name="email" type="email" required placeholder="tucorreo@empresa.com" style={input} />

        <label style={label}>Contraseña</label>
        <PasswordField />

        <button type="submit" style={btn}>
          Crear cuenta
        </button>

        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 18, textAlign: "center" }}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" style={{ color: "var(--accent)" }}>
            Inicia sesión
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
