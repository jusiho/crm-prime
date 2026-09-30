import { env } from "./env";

/**
 * Quién opera la plataforma (ve todas las empresas, cambia planes, suspende).
 *
 * Es una lista de correos en PLATFORM_ADMIN_EMAILS y no un rol en la base a
 * propósito: el rol ADMIN es "administrador de SU empresa", y mezclar los dos
 * es la forma más fácil de que un cliente acabe viendo a los demás. La lista
 * la controla quien despliega, no ningún usuario desde la interfaz.
 */
export function platformAdminEmails(): Set<string> {
  return new Set(
    (env("PLATFORM_ADMIN_EMAILS") ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return platformAdminEmails().has(email.trim().toLowerCase());
}
