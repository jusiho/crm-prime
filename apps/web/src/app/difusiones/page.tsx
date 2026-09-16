import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { CampaignsManager } from "@/features/campaigns/CampaignsManager";

export default async function CampaignsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as { role?: string })?.role;

  return (
    <AppShell email={session.user?.email ?? ""} role={role} active="campaigns">
      <CampaignsManager />
    </AppShell>
  );
}
