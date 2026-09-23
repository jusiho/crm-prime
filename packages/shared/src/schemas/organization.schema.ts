import { z } from "zod";

/**
 * Subdominios que no se pueden registrar como empresa.
 *
 * No es una lista de nombres feos: cada uno rompe algo concreto si se lo queda
 * un cliente. Si alguien registra la empresa "api", `api.trimmo.lat` deja de
 * ser tu API. Si registra "mail", pierdes el correo del dominio.
 *
 * Es más fácil añadir uno mañana que quitárselo a un cliente que ya lo usa, así
 * que la lista peca de larga a propósito.
 */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  // Infraestructura propia
  "www", "api", "app", "admin", "administrator", "root", "system",
  "dashboard", "panel", "console", "portal",
  // Nombres de la propia categoría: si un cliente registra "crm", se queda
  // con crm.tudominio.com, que es justo donde sueles tener el producto.
  "crm", "inbox", "chat", "bot", "bots", "agent", "agents", "ai",
  // Correo y DNS: quitárselos al dominio principal es difícil de revertir
  "mail", "email", "smtp", "imap", "pop", "pop3", "mx", "ns", "ns1", "ns2",
  "dns", "autodiscover", "autoconfig",
  // Contenido y soporte
  "blog", "docs", "doc", "help", "support", "status", "kb",
  "shop", "store", "pay", "billing", "checkout",
  // Entornos y despliegue
  "dev", "test", "testing", "stage", "staging", "prod", "production",
  "demo", "sandbox", "preview", "beta", "alpha", "local", "localhost",
  // Estáticos y red
  "cdn", "static", "assets", "media", "img", "images", "files", "download",
  "ftp", "vpn", "proxy", "gateway", "git", "ci", "registry",
  // Marca y legales
  // La propia marca: que nadie registre "trimmo" y se haga pasar por oficial.
  "trimmo", "about", "legal", "privacy", "terms", "security", "abuse",
  "postmaster", "webmaster", "hostmaster", "noc", "soc",
  // Genéricos que confunden
  "account", "accounts", "auth", "login", "signup", "register", "oauth",
  "static1", "www2", "new", "old", "null", "undefined",
]);

/**
 * Subdominios reservados que añade el despliegue, además de la lista fija.
 *
 * Cada instalación tiene los suyos: los que ya está usando para otra cosa. Van
 * por entorno y no en el código porque son de quien despliega, no del
 * proyecto. `RESERVED_SUBDOMAINS_EXTRA="crm,soporte,blog"`.
 */
export function extraReserved(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Slug de la organización: es una etiqueta DNS, no un nombre bonito.
 *
 * Las reglas salen del DNS, no del gusto:
 * - minúsculas, dígitos y guiones; nada más (RFC 1035)
 * - no puede empezar ni acabar en guión
 * - máximo 63 caracteres, que es el límite de una etiqueta DNS
 * - mínimo 3, para no agotar los cortos ni chocar con reservados
 */
export const orgSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "El subdominio necesita al menos 3 caracteres")
  .max(63, "El subdominio no puede pasar de 63 caracteres")
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
    "Solo minúsculas, números y guiones; no puede empezar ni acabar en guión",
  )
  .refine((s) => !s.includes("--"), {
    message: "No puede llevar dos guiones seguidos",
  })
  .refine((s) => !RESERVED_SUBDOMAINS.has(s), {
    message: "Ese subdominio está reservado, elige otro",
  });

/** Alta de una empresa nueva: crea la organización y su primer administrador. */
export const registerOrgSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  slug: orgSlugSchema,
  adminName: z.string().trim().min(1).max(120),
  adminEmail: z.string().email(),
  password: z.string().min(8).max(200),
});
export type RegisterOrgInput = z.infer<typeof registerOrgSchema>;

/** Respuesta del alta: dónde tiene que ir el usuario ahora. */
export interface RegisterOrgResult {
  orgId: string;
  slug: string;
  /** URL completa del panel de la empresa recién creada. */
  url: string;
}

/**
 * Sugiere un subdominio a partir del nombre de la empresa.
 *
 * Quita tildes, cambia lo que no sea válido por guiones y recorta. Es solo una
 * sugerencia para la interfaz: la validación de verdad la hace `orgSlugSchema`.
 */
export function suggestSlug(companyName: string): string {
  return companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 63)
    .replace(/-+$/, "");
}
