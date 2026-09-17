import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { PasswordField } from "@/components/PasswordField";
import { getTranslator } from "@/i18n/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslator();
  const session = await auth();
  if (session) redirect("/");
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
        : (body?.message ?? t("auth.signUpFailed"));
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
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <LanguageSwitcher />
      </div>
      <form action={register} style={card}>
        <h1 style={{ marginTop: 0 }}>{t("auth.signUpTitle")}</h1>
        <p style={{ color: "var(--muted)", marginTop: -8 }}>
          {t("auth.signUpSubtitle")}
        </p>

        {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}

        <label style={label}>{t("auth.name")}</label>
        <input name="name" type="text" required placeholder={t("auth.namePlaceholder")} style={input} />

        <label style={label}>{t("auth.email")}</label>
        <input name="email" type="email" required placeholder={t("auth.emailPlaceholder")} style={input} />

        <label style={label}>{t("auth.password")}</label>
        <PasswordField />

        <button type="submit" style={btn}>
          {t("auth.createAccount")}
        </button>

        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 18, textAlign: "center" }}>
          {t("auth.haveAccount")}{" "}
          <Link href="/login" style={{ color: "var(--accent)" }}>
            {t("auth.signIn")}
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
