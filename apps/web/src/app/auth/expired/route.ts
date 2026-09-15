import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookieWrites, safeCallbackUrl } from "@/lib/session-token";

// Destino cuando la sesión terminó: borra la cookie (si no, /login la vería y
// devolvería al inicio) y manda al login recordando a dónde volver.
export function GET(req: NextRequest) {
  const callbackUrl = safeCallbackUrl(req.nextUrl.searchParams.get("callbackUrl"));
  const params = new URLSearchParams({ expired: "1" });
  if (callbackUrl !== "/") params.set("callbackUrl", callbackUrl);

  // Location relativa: detrás del proxy, req.url lleva el host interno.
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: `/login?${params.toString()}`, "Cache-Control": "no-store" },
  });
  for (const w of clearSessionCookieWrites(req.cookies)) {
    res.cookies.set(w.name, w.value, w.options);
  }
  return res;
}
