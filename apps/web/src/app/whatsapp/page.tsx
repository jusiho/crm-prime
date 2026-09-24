import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { WhatsAppConnect } from "@/features/whatsapp/WhatsAppConnect";

export default async function WhatsAppPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as { role?: string })?.role;

  return (
    <AppShell email={session.user?.email ?? ""} role={role} active="whatsapp">
      {/* En SaaS el SDK de Meta no carga aquí: el botón salta al conector del
          dominio raíz, el único que Meta tiene listado. */}
      <WhatsAppConnect hub={!!process.env.SAAS_BASE_DOMAIN} />
    </AppShell>
  );
}
