// Idiomas de la aplicación. El idioma se guarda en una cookie (no en la URL)
// para no romper enlaces ya existentes y para que el servidor lo sepa antes de
// pintar, sin el parpadeo de traducir en el navegador.

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Elige idioma a partir de la cabecera Accept-Language del navegador. Se usa
 * solo la primera vez, cuando el usuario todavía no ha elegido.
 */
export function localeFromHeader(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase() ?? "";
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
