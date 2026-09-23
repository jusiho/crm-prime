import { headers } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export interface OrgPublic {
  slug: string;
  name: string;
}

/**
 * En qué contexto de empresa estamos.
 *
 * Son tres estados y no dos, y confundirlos se nota: "no hay subdominio" y
 * "hay un subdominio que no corresponde a ninguna empresa" llevan a pantallas
 * distintas. Si se tratan igual, `loquesea.trimmo.lat` enseña un formulario de
 * acceso que no puede funcionar nunca, y el visitante no sabe si se equivocó de
 * dirección o si el sitio está roto.
 */
export type OrgContext =
  | { kind: "none" }
  | { kind: "found"; org: OrgPublic }
  | { kind: "unknown"; slug: string };

/**
 * El subdominio de esta petición, o null si no hay.
 *
 * Lo pone el middleware a partir del `Host` real. Null significa: instalación
 * de una sola empresa, o alguien entrando por el dominio principal.
 */
export async function currentOrgSlug(): Promise<string | null> {
  const h = await headers();
  return h.get("x-org-slug");
}

/** Resuelve el subdominio contra la API. */
export async function currentOrgContext(): Promise<OrgContext> {
  const slug = await currentOrgSlug();
  if (!slug) return { kind: "none" };

  try {
    const res = await fetch(`${API_URL}/api/v1/organizations/${slug}/public`, {
      // El nombre cambia poco y esta es la página que más se abre sin sesión.
      next: { revalidate: 300 },
    });
    if (!res.ok) return { kind: "unknown", slug };
    return { kind: "found", org: (await res.json()) as OrgPublic };
  } catch {
    // La API caída no es lo mismo que una empresa inexistente, pero desde
    // aquí no se distingue. Se elige el mensaje que no miente: "no la
    // encontramos" es cierto en los dos casos.
    return { kind: "unknown", slug };
  }
}

/** Atajo para cuando solo interesa la empresa si existe. */
export async function currentOrg(): Promise<OrgPublic | null> {
  const ctx = await currentOrgContext();
  return ctx.kind === "found" ? ctx.org : null;
}
