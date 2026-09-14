import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { Inbox } from "@/features/inbox/Inbox";
import { Landing } from "@/features/marketing/Landing";
import { display, body } from "@/features/marketing/fonts";

export default async function Home() {
  const session = await auth();

  // Visitante no logueado → landing pública de ventas.
  if (!session) {
    return (
      <div className={`${display.variable} ${body.variable}`}>
        <Landing />
      </div>
    );
  }

  // Usuario logueado → la app (bandeja).
  const role = (session.user as { role?: string })?.role;
  return (
    <AppShell email={session.user?.email ?? ""} role={role} active="inbox">
      <Inbox />
    </AppShell>
  );
}
