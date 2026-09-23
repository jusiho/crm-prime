import { NextResponse, type NextRequest } from "next/server";

/**
 * Resuelve el subdominio de cada petición: `acme.trimmo.lat` → "acme".
 *
 * ── Lo único que hace, y lo que NO hace ──────────────────────
 * Pone el slug en una cabecera para que las páginas sepan **qué pantalla de
 * acceso enseñar**. No decide de quién son los datos: eso sale del `orgId`
 * firmado dentro del token, y lo comprueba el backend.
 *
 * La diferencia importa. El `Host` lo controla quien llama: con `curl -H "Host:
 * otra-empresa.trimmo.lat"` cualquiera puede decir lo que quiera. Si el
 * subdominio decidiera el acceso, eso sería toda la intrusión.
 */

const BASE = (process.env.SAAS_BASE_DOMAIN ?? "")
  .split(":")[0]
  ?.toLowerCase();

/** Subdominios que nunca son una empresa. */
const NO_SON_EMPRESA = new Set(["www", "app", "api", "admin"]);

function slugDe(host: string): string | null {
  if (!BASE) return null; // modo de una sola empresa: no hay subdominios
  const limpio = host.split(":")[0]?.toLowerCase() ?? "";
  if (!limpio.endsWith(`.${BASE}`)) return null;

  const slug = limpio.slice(0, -(BASE.length + 1));
  // Un solo nivel: es lo que cubre el certificado comodín.
  if (!slug || slug.includes(".")) return null;
  if (NO_SON_EMPRESA.has(slug)) return null;
  return slug;
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const slug = slugDe(host);

  // Se reescriben las cabeceras de entrada, no las de salida: así las páginas y
  // los route handlers lo leen con headers(), y no se filtra al navegador.
  const headers = new Headers(req.headers);
  if (slug) headers.set("x-org-slug", slug);
  else headers.delete("x-org-slug"); // que nadie la inyecte desde fuera

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Todo menos estáticos: el slug hace falta en páginas y en el BFF.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
