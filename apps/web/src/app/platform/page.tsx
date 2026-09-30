import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { PlatformConsole } from "@/features/platform/PlatformConsole";
import { PlatformShell } from "@/features/platform/PlatformShell";
import { isPlatformHost, platformConsoleUrl } from "@/lib/org";

/**
 * Consola del operador del SaaS. Vive en admin.<dominio>, con su propio login.
 * Desde el subdominio de una empresa se manda allí; en instalación de una sola
 * empresa (sin dominio base) se sirve dentro del panel, como siempre.
 */
export default async function PlatformPage() {
  const consoleUrl = platformConsoleUrl();
  const onConsoleHost = await isPlatformHost();
  if (consoleUrl && !onConsoleHost) redirect(consoleUrl);

  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { role?: string; orgSlug?: string; platformAdmin?: boolean };

  if (!user.platformAdmin) {
    // En la consola no se redirige a "/" (el middleware lo devolvería aquí):
    // se explica y se ofrece salir para entrar con otra cuenta.
    if (onConsoleHost) {
      return (
        <PlatformShell email={session.user?.email ?? ""}>
          <div className="pc" style={{ maxWidth: 560, paddingTop: 64 }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>Esta cuenta no es de operador</h1>
            <p style={{ color: "var(--muted)", lineHeight: 1.5 }}>
              La consola de plataforma es solo para los correos incluidos en
              PLATFORM_ADMIN_EMAILS. Sal con el botón de arriba y entra con la cuenta de operador.
            </p>
          </div>
        </PlatformShell>
      );
    }
    redirect("/");
  }

  if (onConsoleHost) {
    return (
      <PlatformShell email={session.user?.email ?? ""}>
        <PlatformConsole myOrgSlug={user.orgSlug} />
      </PlatformShell>
    );
  }
  return (
    <AppShell email={session.user?.email ?? ""} role={user.role} active="platform">
      <PlatformConsole myOrgSlug={user.orgSlug} />
    </AppShell>
  );
}
