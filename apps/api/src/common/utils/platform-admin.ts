import * as bcrypt from "bcryptjs";
import { env } from "./env";

/**
 * La cuenta maestra del SaaS: quien opera la plataforma (ve todas las
 * empresas, cambia planes, suspende).
 *
 * No es un usuario de ninguna empresa ni vive en la base: son dos variables
 * del servidor. Así no hace falta crear una empresa para gestionar el SaaS, y
 * ningún fallo de permisos dentro de una empresa puede convertir a alguien en
 * operador. Quien controla el despliegue controla esta cuenta.
 *
 *   PLATFORM_ADMIN_EMAIL           correo con el que se entra en admin.<dominio>
 *   PLATFORM_ADMIN_PASSWORD_HASH   hash bcrypt de la contraseña, en base64
 *                                  (lo genera `npm run platform:password`)
 *
 * El hash va en base64 porque un bcrypt lleva `$`, y Docker Compose trata `$`
 * como variable al leer el .env: el hash llegaría mutilado y nadie podría
 * entrar, sin ningún error que lo explique. Se acepta también en crudo.
 */
export function platformAdminEmail(): string | null {
  const e = env("PLATFORM_ADMIN_EMAIL")?.trim().toLowerCase();
  return e || null;
}

function platformPasswordHash(): string | null {
  const raw = env("PLATFORM_ADMIN_PASSWORD_HASH")?.trim();
  if (!raw) return null;
  if (raw.startsWith("$2")) return raw;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return decoded.startsWith("$2") ? decoded : null;
  } catch {
    return null;
  }
}

/** ¿Está configurada la cuenta maestra? */
export function platformAdminConfigured(): boolean {
  return !!platformAdminEmail() && !!platformPasswordHash();
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  const admin = platformAdminEmail();
  return !!admin && !!email && email.trim().toLowerCase() === admin;
}

/** Correo y contraseña de la cuenta maestra. Tiempo constante en el caso malo. */
export async function verifyPlatformAdmin(email: string, password: string): Promise<boolean> {
  const hash = platformPasswordHash();
  // Sin configurar se compara igual contra un hash cualquiera: que la
  // respuesta tarde lo mismo y no delate si la cuenta existe.
  const ok = await bcrypt.compare(password, hash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  return ok && !!hash && isPlatformAdmin(email);
}
