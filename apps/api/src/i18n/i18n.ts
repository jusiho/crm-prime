import {
  DYNAMIC_MESSAGES,
  ES_TO_EN,
  type DynamicMessageKey,
} from "./messages";

export const LOCALES = ["en", "es"] as const;
export type ApiLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: ApiLocale = "en";

/** Idioma pedido por el cliente (cabecera Accept-Language). */
export function resolveLocale(acceptLanguage?: string | string[]): ApiLocale {
  const header = Array.isArray(acceptLanguage)
    ? acceptLanguage[0]
    : acceptLanguage;
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const base = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    if (base && (LOCALES as readonly string[]).includes(base)) {
      return base as ApiLocale;
    }
  }
  return DEFAULT_LOCALE;
}

/** Marca un mensaje con datos dentro, para traducirlo al responder. */
export interface I18nMessage {
  i18n: DynamicMessageKey;
  params: Record<string, string | number>;
}

export function i18n(
  key: DynamicMessageKey,
  params: Record<string, string | number> = {},
): I18nMessage {
  return { i18n: key, params };
}

function isI18nMessage(value: unknown): value is I18nMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "i18n" in value &&
    typeof (value as I18nMessage).i18n === "string"
  );
}

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Traduce un mensaje de error. Los fijos se buscan por su texto en español;
 * los que llevan datos vienen marcados con su clave. Si algo no está en la
 * tabla, se devuelve tal cual: se ve en español, pero nunca vacío.
 */
export function translateMessage(message: unknown, locale: ApiLocale): unknown {
  if (isI18nMessage(message)) {
    const entry = DYNAMIC_MESSAGES[message.i18n];
    if (!entry) return message.i18n;
    return fill(entry[locale] ?? entry.es, message.params);
  }
  if (Array.isArray(message)) {
    return message.map((m) => translateMessage(m, locale));
  }
  if (typeof message !== "string") return message;
  if (locale === "es") return message;
  return ES_TO_EN[message] ?? message;
}
