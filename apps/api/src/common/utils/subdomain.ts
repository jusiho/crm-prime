import { env } from "./env";

/** Hosts de infraestructura que nunca son una empresa. */
const NO_SON_EMPRESA = new Set(["www", "api", "app", "admin"]);

/**
 * Saca el subdominio de empresa de un `Host`, o `undefined` si no lo hay.
 *
 *   acme.trimmo.lat        → "acme"
 *   trimmo.lat             → undefined   (dominio raíz)
 *   api.trimmo.lat         → undefined   (infraestructura)
 *   a.b.trimmo.lat         → undefined   (dos niveles: el comodín no llega)
 *   localhost:3001         → undefined   (sin dominio base configurado)
 *
 * Lo que devuelve NUNCA concede acceso: el `Host` lo controla quien llama.
 * Sirve para dos cosas y solo dos: elegir a quién buscar en el login, y
 * comprobar que una clave de API se usa contra la dirección de su empresa.
 */
export function subdominioDe(host: string | undefined): string | undefined {
  const limpio = (host ?? "").split(":")[0]?.toLowerCase() ?? "";
  const base = (env("SAAS_BASE_DOMAIN") ?? "").split(":")[0]?.toLowerCase();
  if (!base || !limpio.endsWith(`.${base}`)) return undefined;
  const slug = limpio.slice(0, -(base.length + 1));
  if (!slug || slug.includes(".") || NO_SON_EMPRESA.has(slug)) return undefined;
  return slug;
}

/** El host real de la petición, mirando primero lo que dejó el proxy. */
export function hostDe(headers: Record<string, string | string[] | undefined>): string {
  const h = headers["x-forwarded-host"] ?? headers["host"];
  return Array.isArray(h) ? (h[0] ?? "") : (h ?? "");
}
