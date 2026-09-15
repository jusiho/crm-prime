import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { safeCallbackUrl } from "@/lib/session-token";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; expired?: string; callbackUrl?: string }>;
}) {
  const { error, expired, callbackUrl: rawCallback } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallback);
  const session = await auth();
  if (session) redirect(callbackUrl);

  async function login(formData: FormData) {
    "use server";
    const target = safeCallbackUrl(formData.get("callbackUrl"));
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: target,
      });
    } catch (e) {
      // signIn lanza NEXT_REDIRECT al tener éxito (hay que re-lanzarlo).
      // Si las credenciales fallan, lanza AuthError → volvemos con error.
      if (e instanceof AuthError) {
        const params = new URLSearchParams({ error: "credentials" });
        if (target !== "/") params.set("callbackUrl", target);
        redirect(`/login?${params.toString()}`);
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
        <h1 style={{ marginTop: 0 }}>CRM Prime</h1>
        <p style={{ color: "var(--muted)", marginTop: -8 }}>Inicia sesión</p>

        {error ? (
          <p style={{ color: "#ff6b6b" }}>Credenciales inválidas.</p>
        ) : expired ? (
          <p style={{ color: "var(--muted)" }}>
            Tu sesión expiró. Vuelve a iniciar sesión.
          </p>
        ) : null}

        <input type="hidden" name="callbackUrl" value={callbackUrl} />

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
