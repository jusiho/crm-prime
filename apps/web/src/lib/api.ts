import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { REFRESH_UNAVAILABLE_HEADER, readSessionCookie } from "@/lib/session-token";
import { getLocale } from "@/i18n/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

const JSON_HEADERS = { "content-type": "application/json" };

/** 401 que la web interpreta como "sesión terminada" y manda al login. */
export function sessionExpiredResponse(): Response {
  return new Response(
    JSON.stringify({
      message: "Tu sesión expiró. Vuelve a iniciar sesión.",
      code: "SESSION_EXPIRED",
      statusCode: 401,
    }),
    { status: 401, headers: JSON_HEADERS },
  );
}

function refreshUnavailableResponse(): Response {
  return new Response(
    JSON.stringify({
      message: "No se pudo renovar tu sesión. Reintenta en unos segundos.",
      code: "SESSION_REFRESH_UNAVAILABLE",
      statusCode: 503,
    }),
    { status: 503, headers: JSON_HEADERS },
  );
}

/**
 * Access token de la cookie de sesión (solo servidor). Devuelve una Response
 * de error lista para enviar si no se puede usar.
 */
export async function requireAccessToken(): Promise<string | Response> {
  if ((await headers()).get(REFRESH_UNAVAILABLE_HEADER)) {
    return refreshUnavailableResponse();
  }
  const session = await readSessionCookie(await cookies());
  const accessToken = session?.token.accessToken;
  return typeof accessToken === "string" && accessToken
    ? accessToken
    : sessionExpiredResponse();
}

/**
 * Para Server Components: devuelve el JSON del backend. Si la sesión terminó,
 * manda al login (vía /auth/expired, que borra la cookie) en vez de romper.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiForward(path, init);
  if (res.status === 401) {
    const body = (await res.clone().json().catch(() => null)) as { code?: string } | null;
    if (body?.code === "SESSION_EXPIRED") redirect("/auth/expired");
  }
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Cliente de API server-side (BFF): se ejecuta en el servidor de Next,
 * lee el access token de la cookie httpOnly y lo adjunta como Bearer al
 * llamar a NestJS. El navegador nunca maneja el JWT.
 *
 * Devuelve la Response cruda para que los route handlers propaguen el status
 * y el cuerpo del backend tal cual (p. ej. un 400 "fuera de ventana 24h").
 */
export async function apiForward(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await requireAccessToken();
  if (token instanceof Response) return token;
  return fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      // Para que los mensajes de error vuelvan en el idioma del usuario.
      "Accept-Language": await getLocale(),
      ...init.headers,
    },
    cache: "no-store",
  });
}

/** Reenvía una Response del backend conservando status y JSON. */
export async function relay(res: Response): Promise<Response> {
  const text = await res.text();
  return new Response(text, { status: res.status, headers: JSON_HEADERS });
}
