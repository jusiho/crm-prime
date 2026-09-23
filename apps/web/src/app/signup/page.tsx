import { redirect } from "next/navigation";
import { currentOrgSlug } from "@/lib/org";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Crea tu empresa" };

/**
 * Alta de empresa. Vive en el dominio principal a propósito: desde el
 * subdominio de una empresa no tiene sentido crear otra, así que se redirige a
 * su propio acceso.
 */
export default async function SignupPage() {
  if (await currentOrgSlug()) redirect("/login");

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
      <SignupForm baseDomain={process.env.SAAS_BASE_DOMAIN ?? "localhost:3000"} />
    </main>
  );
}
