import { decode, encode, type JWT } from "next-auth/jwt";
import type { AuthTokens } from "@crm/shared";

// Solo servidor (middleware, route handlers, server actions): maneja la cookie
// de sesión de Auth.js directamente, porque `auth()` en App Router no puede
// guardar un token refrescado (descarta el Set-Cookie).

const API_URL = process.env.API_URL ?? "http://localhost:3001";

const BASE_NAME = "authjs.session-token";
const SECURE_NAME = `__Secure-${BASE_NAME}`;
// Mismos valores que @auth/core (lib/utils/cookie.js) para trocear la cookie.
const CHUNK_SIZE = 4096 - 160;
const MAX_AGE = 30 * 24 * 60 * 60;

export interface CookieReader {
  getAll(): { name: string; value: string }[];
}

export const REFRESH_UNAVAILABLE_HEADER = "x-session-refresh-unavailable";

interface CookieOptions {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  secure: boolean;
  maxAge: number;
}

/** Una cookie a escribir; `maxAge: 0` significa borrarla. */
export interface CookieWrite {
  name: string;
  value: string;
  options: CookieOptions;
}

export interface SessionCookie {
  name: string;
  token: JWT;
}

/** Nombre base de la cookie de sesión presente (con o sin prefijo __Secure-). */
function presentName(cookies: CookieReader): string | null {
  const names = cookies.getAll().map((c) => c.name);
  const has = (base: string) =>
    names.some((n) => n === base || n.startsWith(`${base}.`));
  if (has(SECURE_NAME)) return SECURE_NAME;
  if (has(BASE_NAME)) return BASE_NAME;
  return null;
}

/** Valor completo: entero, o las partes `.0`, `.1`… unidas en orden. */
function rawValue(cookies: CookieReader, name: string): string | null {
  const all = cookies.getAll();
  const whole = all.find((c) => c.name === name);
  if (whole) return whole.value;
  const chunks = all
    .filter((c) => c.name.startsWith(`${name}.`))
    .sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop()));
  return chunks.length ? chunks.map((c) => c.value).join("") : null;
}

export async function readSessionCookie(
  cookies: CookieReader,
): Promise<SessionCookie | null> {
  const name = presentName(cookies);
  if (!name) return null;
  const raw = rawValue(cookies, name);
  const secret = process.env.AUTH_SECRET;
  if (!raw || !secret) return null;
  try {
    const token = await decode({ token: raw, secret, salt: name });
    return token ? { name, token } : null;
  } catch {
    return null;
  }
}

function cookieOptions(name: string, maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: name.startsWith("__Secure-"),
    maxAge,
  };
}

/**
 * Cookies a escribir para guardar `token`: troceada si no cabe, y borrando las
 * partes sobrantes de la versión anterior. Se cifra una sola vez.
 */
export async function sessionCookieWrites(
  existing: CookieReader,
  name: string,
  token: JWT,
): Promise<CookieWrite[]> {
  const secret = process.env.AUTH_SECRET!;
  const value = await encode({ token, secret, salt: name, maxAge: MAX_AGE });
  const parts =
    value.length <= CHUNK_SIZE
      ? [{ name, value }]
      : Array.from({ length: Math.ceil(value.length / CHUNK_SIZE) }, (_, i) => ({
          name: `${name}.${i}`,
          value: value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        }));
  const keep = new Set(parts.map((p) => p.name));
  const stale = existing
    .getAll()
    .map((c) => c.name)
    .filter((n) => (n === name || n.startsWith(`${name}.`)) && !keep.has(n));
  return [
    ...parts.map((p) => ({ ...p, options: cookieOptions(name, MAX_AGE) })),
    ...stale.map((n) => ({ name: n, value: "", options: cookieOptions(n, 0) })),
  ];
}

/** Cookies a escribir para borrar la sesión (y sus partes). */
export function clearSessionCookieWrites(existing: CookieReader): CookieWrite[] {
  return existing
    .getAll()
    .map((c) => c.name)
    .filter((n) => [BASE_NAME, SECURE_NAME].some((b) => n === b || n.startsWith(`${b}.`)))
    .map((n) => ({ name: n, value: "", options: cookieOptions(n, 0) }));
}

export type RefreshResult =
  | { kind: "ok"; tokens: AuthTokens }
  | { kind: "dead" }
  | { kind: "unavailable" };

/** Canjea el refresh token. "dead" = el backend lo rechazó; hay que re-loguear. */
export async function refreshTokens(refreshToken: unknown): Promise<RefreshResult> {
  if (typeof refreshToken !== "string" || !refreshToken) return { kind: "dead" };
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (res.ok) return { kind: "ok", tokens: (await res.json()) as AuthTokens };
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { kind: "dead" };
    }
    return { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Revoca en el backend la sesión a la que pertenece el refresh token. */
export async function revokeRefreshToken(refreshToken: unknown): Promise<void> {
  if (typeof refreshToken !== "string" || !refreshToken) return;
  await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  }).catch(() => undefined);
}

/**
 * Destino seguro tras el login: solo rutas internas ("/…", nunca "//host"),
 * y nunca las de sesión (volver a /auth/expired borraría la cookie recién creada).
 */
export function safeCallbackUrl(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  if (/^\/(auth|login|register|api)(\/|\?|$)/.test(value)) return "/";
  return value;
}
