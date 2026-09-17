"use client";

import { createContext, useContext, useMemo } from "react";
import { en } from "./messages/en";
import { translate, type MessageKey, type TranslateParams } from "./translate";
import type { Locale } from "./config";

interface I18nValue {
  locale: Locale;
  t: (key: MessageKey, params?: TranslateParams) => string;
}

// El diccionario llega desde el servidor ya resuelto, así que el navegador no
// descarga los idiomas que no usa.
const I18nContext = createContext<I18nValue>({
  locale: "en",
  t: (key, params) => translate(en, en, key, params),
});

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: unknown;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: (key, params) => translate(messages, en, key, params),
    }),
    [locale, messages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Traductor para componentes del navegador. */
export function useT(): I18nValue["t"] {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
