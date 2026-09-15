import { NextResponse, type NextRequest } from "next/server";
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
};
