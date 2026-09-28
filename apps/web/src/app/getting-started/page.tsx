import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { GettingStarted } from "@/features/onboarding/GettingStarted";

export default async function GettingStartedPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as { role?: string })?.role;

  return (
    <AppShell email={session.user?.email ?? ""} role={role} active="gettingStarted">
      <GettingStarted role={role} />
    </AppShell>
  );
}
