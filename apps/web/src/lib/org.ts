import { headers } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export interface OrgPublic {
  slug: string;
  name: string;
}

/**
 * La empresa del subdominio actual, o null si no estamos en uno.
 *
 * Null significa dos cosas distintas y las dos se tratan igual: o la
 * instalación es de una sola empresa (open source), o estamos en el dominio
 * principal, donde se da de alta gente nueva.
 */
export async function currentOrgSlug(): Promise<string | null> {
  const h = await headers();
  return h.get("x-org-slug");
}

/** Nombre de la empresa para la pantalla de acceso. Null si el slug no existe. */
export async function currentOrg(): Promise<OrgPublic | null> {
  const slug = await currentOrgSlug();
  if (!slug) return null;
  try {
    const res = await fetch(`${API_URL}/api/v1/organizations/${slug}/public`, {
      // El nombre cambia poco; cachearlo evita una llamada en cada carga del
      // login, que es justo la página que más se abre sin sesión.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as OrgPublic;
  } catch {
    return null;
  }
}
