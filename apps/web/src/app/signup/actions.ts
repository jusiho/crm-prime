"use server";

import { registerOrgSchema, type RegisterOrgResult } from "@crm/shared";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export type Campo = "companyName" | "slug" | "adminName" | "adminEmail" | "password";

export type SignupResult =
  | { ok: true; url: string; handoffToken: string; slug: string }
  | { ok: false; error: string; field?: Campo };

/**
 * Traduce el error de la API a "qué campo y qué mensaje".
 *
 * La validación del servidor devuelve `"slug: Ese subdominio está reservado"`,
 * y así el formulario puede volver al paso donde vive ese campo y marcarlo, en
 * vez de enseñar un error genérico en la última pantalla, lejos de la causa.
 */
function traducir(status: number, message: string | string[] | undefined): SignupResult {
  const texto = Array.isArray(message) ? message[0] : message;

  if (status === 409) return { ok: false, error: texto ?? "Ese subdominio ya está ocupado", field: "slug" };
  if (status === 429) return { ok: false, error: texto ?? "Demasiados intentos. Espera un rato." };

  const m = /^(companyName|slug|adminName|adminEmail|password): (.+)$/.exec(texto ?? "");
  if (m) return { ok: false, error: m[2]!, field: m[1] as Campo };

  return { ok: false, error: texto ?? "No se pudo crear la empresa" };
}

export async function registerOrg(datos: unknown): Promise<SignupResult> {
  const parsed = registerOrgSchema.safeParse(datos);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Revisa los datos", field: first?.path[0] as Campo };
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/organizations/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "No hay conexión con el servidor. Inténtalo de nuevo." };
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    return traducir(res.status, body.message);
  }

  const r = (await res.json()) as RegisterOrgResult;
  return { ok: true, url: r.url, handoffToken: r.handoffToken, slug: r.slug };
}

/** ¿Está libre el subdominio? Para avisar mientras se escribe. */
export async function checkSlug(slug: string): Promise<{ available: boolean; reason?: string }> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/organizations/slug-available?slug=${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { available: false, reason: "No se pudo comprobar" };
    return (await res.json()) as { available: boolean; reason?: string };
  } catch {
    return { available: false, reason: "No se pudo comprobar" };
  }
}
