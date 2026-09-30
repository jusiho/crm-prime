import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { PlatformConsole } from "@/features/platform/PlatformConsole";

/** Consola del operador del SaaS. Solo para los correos de PLATFORM_ADMIN_EMAILS. */
export default async function PlatformPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { role?: string; orgSlug?: string; platformAdmin?: boolean };
  if (!user.platformAdmin) redirect("/");

  return (
    <AppShell email={session.user?.email ?? ""} role={user.role} active="platform">
      <PlatformConsole myOrgSlug={user.orgSlug} />
    </AppShell>
  );
}
