"use server";

import { registerOrgSchema, type RegisterOrgResult } from "@crm/shared";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export interface SignupState {
  error?: string;
  /** Campo concreto que falló, para resaltarlo. */
  field?: string;
  url?: string;
}

/** Alta de empresa. Devuelve la URL del subdominio recién creado. */
export async function registerOrg(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = registerOrgSchema.safeParse({
    companyName: formData.get("companyName"),
    slug: formData.get("slug"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Revisa los datos", field: String(first?.path[0] ?? "") };
  }

  const res = await fetch(`${API_URL}/api/v1/organizations/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message[0] : body.message;
    return { error: msg ?? "No se pudo crear la empresa", field: "slug" };
  }

  const { url } = (await res.json()) as RegisterOrgResult;
  // No se redirige desde aquí: el alta cambia de dominio (a otro subdominio) y
  // conviene enseñar antes a dónde va, en vez de saltar sin avisar.
  return { url };
}

/** ¿Está libre el subdominio? Para avisar mientras se escribe. */
export async function checkSlug(
  slug: string,
): Promise<{ available: boolean; reason?: string }> {
  if (!slug || slug.length < 3) return { available: false, reason: "Muy corto" };
  const res = await fetch(
    `${API_URL}/api/v1/organizations/slug-available?slug=${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return { available: false, reason: "No se pudo comprobar" };
  return (await res.json()) as { available: boolean; reason?: string };
}
