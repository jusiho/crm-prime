import { cookies, headers } from "next/headers";
import { en } from "./messages/en";
import { es } from "./messages/es";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  localeFromHeader,
  type Locale,
} from "./config";
import { translate, type MessageKey, type TranslateParams } from "./translate";

const DICTIONARIES = { en, es } as const;

/**
 * Idioma de esta petición: lo que eligió el usuario (cookie) y, si nunca
 * eligió, lo que pide su navegador.
 */
export async function getLocale(): Promise<Locale> {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return localeFromHeader((await headers()).get("accept-language"));
}

export function getMessages(locale: Locale) {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** Traductor para Server Components. */
export async function getTranslator(): Promise<
  (key: MessageKey, params?: TranslateParams) => string
> {
  const messages = getMessages(await getLocale());
  return (key, params) => translate(messages, en, key, params);
}
