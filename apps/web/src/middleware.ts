import { NextResponse, type NextRequest } from "next/server";
<<<<<<< HEAD

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
=======
import {
  REFRESH_UNAVAILABLE_HEADER,
  clearSessionCookieWrites,
  readSessionCookie,
  refreshTokens,
  sessionCookieWrites,
  type CookieWrite,
} from "@/lib/session-token";

// Renueva el access token aquí porque es el único punto de App Router que puede
// reescribir la cookie a la vez para el navegador y para la request en curso.
// Si se refrescara dentro de `auth()` (callback jwt), el refresh token rotado
// se perdería y el backend acabaría revocando la sesión por "reuso".

const REFRESH_MARGIN_MS = 60_000;

function forward(req: NextRequest, writes: CookieWrite[] = []): NextResponse {
  // La cookie de la request debe quedar lista ANTES de crear la response:
  // NextResponse.next copia las cabeceras en ese momento.
  for (const w of writes) {
    if (w.options.maxAge === 0) req.cookies.delete(w.name);
    else req.cookies.set(w.name, w.value);
  }
  const res = NextResponse.next({ request: { headers: req.headers } });
  for (const w of writes) res.cookies.set(w.name, w.value, w.options);
  return res;
}

export async function middleware(req: NextRequest) {
  // Nadie de fuera puede fingir este estado.
  req.headers.delete(REFRESH_UNAVAILABLE_HEADER);

  const session = await readSessionCookie(req.cookies);
  const expires = session?.token.accessTokenExpires as number | undefined;
  if (!session || !expires || Date.now() < expires - REFRESH_MARGIN_MS) {
    return forward(req);
  }

  const existing = req.cookies.getAll();
  const reader = { getAll: () => existing };
  const result = await refreshTokens(session.token.refreshToken);

  if (result.kind === "unavailable") {
    // Backend caído o con error: no se echa al usuario, se avisa al BFF.
    req.headers.set(REFRESH_UNAVAILABLE_HEADER, "1");
    return forward(req);
  }

  if (result.kind === "dead") {
    return forward(req, clearSessionCookieWrites(reader));
  }

  const { tokens } = result;
  const token = {
    ...session.token,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpires: Date.now() + tokens.expiresIn * 1000,
    role: tokens.user.role,
  };
  return forward(req, await sessionCookieWrites(reader, session.name, token));
}

export const config = {
  runtime: "nodejs",
  matcher: [
    "/((?!api/auth|auth/expired|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico|css|js|map|woff2?|txt)$).*)",
  ],
>>>>>>> 2da1df078dfaeb0e81b9d1a84182da2d2c7e8417
};
