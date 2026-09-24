"use server";

import { redirect } from "next/navigation";
import { orgSlugSchema } from "@crm/shared";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

/**
 * "¿Cuál es tu empresa?" — el acceso desde el dominio raíz.
 *
 * El dominio raíz no inicia sesión: en SaaS el correo no identifica a nadie
 * por sí solo (puede existir en dos empresas), así que primero hay que saber
 * a qué empresa vas. Se comprueba que exista y se salta a su subdominio, que
 * es donde vive el formulario de verdad. Igual que Slack con el workspace.
 */
export async function buscarEmpresa(formData: FormData): Promise<void> {
  const base = process.env.SAAS_BASE_DOMAIN ?? "localhost:3000";
  const crudo = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    // Aceptar que peguen la dirección entera: "acme.trimmo.lat" → "acme".
    .replace(/^https?:\/\//, "")
    .replace(new RegExp(`\.${base.split(":")[0]!.replace(/\./g, "\.")}.*$`), "");

  const v = orgSlugSchema.safeParse(crudo);
  if (!v.success) {
    redirect(`/login?error=unknown-company&slug=${encodeURIComponent(crudo)}`);
  }

  const res = await fetch(`${API_URL}/api/v1/organizations/${v.data}/public`, {
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) {
    redirect(`/login?error=unknown-company&slug=${encodeURIComponent(v.data)}`);
  }

  const protocolo = base.startsWith("localhost") ? "http" : "https";
  redirect(`${protocolo}://${v.data}.${base}/login`);
}
