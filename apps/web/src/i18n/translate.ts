import type { Messages } from "./messages/en";

// Claves en formato "seccion.clave", derivadas del diccionario inglés: si
// escribes una clave que no existe, no compila.
type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never;

export type MessageKey = Paths<Messages>;

type Paths<T> = {
  [K in keyof T]: T[K] extends string ? K : Join<K, Paths<T[K]>>;
}[keyof T];

export type TranslateParams = Record<string, string | number>;

function lookup(messages: unknown, key: string): string | undefined {
  const value = key
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined,
      messages,
    );
  return typeof value === "string" ? value : undefined;
}

/**
 * Sustituye {marcadores} por sus valores. Si falta la traducción, cae al
 * inglés; si tampoco está, devuelve la clave, que es visible en pantalla y
 * delata el hueco en vez de dejar un texto vacío.
 */
export function translate(
  messages: unknown,
  fallback: unknown,
  key: string,
  params?: TranslateParams,
): string {
  const template = lookup(messages, key) ?? lookup(fallback, key) ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export type Translator = (key: MessageKey, params?: TranslateParams) => string;
