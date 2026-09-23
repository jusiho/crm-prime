import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

/**
 * Última parada del alta: `acme.trimmo.lat/handoff?token=…`.
 *
 * Canjea el pase por una sesión de ESTE subdominio y manda al panel. Es una
 * ruta y no una página porque no hay nada que enseñar: si el pase vale, el
 * usuario nunca la ve; si no vale, tampoco — acaba en el acceso con un aviso.
 *
 * El pase caduca en dos minutos y se anula al primer uso, así que el enlace
 * que queda en el historial del navegador no sirve para nada.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) redirect("/login");

  try {
    await signIn("credentials", { handoff: token, redirectTo: "/" });
  } catch (e) {
    // El pase no vale (caducado, usado, manipulado): al acceso normal, que la
    // contraseña la sabe porque la acaba de elegir.
    if (e instanceof AuthError) redirect("/login?error=handoff");
    // Con éxito, signIn lanza el redirect de Next: hay que dejarlo pasar.
    throw e;
  }
  redirect("/");
}
