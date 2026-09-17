// Comprueba que ninguna cadena de la interfaz se quede sin traducir.
//
// Que falten claves no hace falta comprobarlo aquí: `es` está tipado como
// `Messages`, así que una clave ausente ya no compila. Lo que TypeScript no
// puede ver es una traducción copiada tal cual del inglés, y eso es lo que
// busca este script.
//
// Se ejecuta con: npm run check:i18n -w @crm/web
import { en } from "../src/i18n/messages/en";
import { es } from "../src/i18n/messages/es";

/** Términos que son iguales en los dos idiomas a propósito. */
const SAME_ON_PURPOSE = new Set([
  "common.no",
  "nav.whatsapp",
  "nav.pipeline",
  "pages.whatsapp.title",
  "pages.pipeline.title",
  "auth.signInTitle",
  "auth.email",
  "inbox.modeAuto",
  "inbox.modeCopilot",
  "inbox.aiOff",
  "inbox.aiCopilot",
  "inbox.aiAutopilot",
  "inbox.sentimentNeutral",
  "inbox.emojis",
]);

function flatten(obj: unknown, prefix = ""): [string, string][] {
  if (typeof obj !== "object" || obj === null) return [];
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string"
      ? [[`${prefix}${k}`, v] as [string, string]]
      : flatten(v, `${prefix}${k}.`),
  );
}

const spanish = new Map(flatten(es));
const untranslated = flatten(en).filter(
  ([key, value]) => spanish.get(key) === value && !SAME_ON_PURPOSE.has(key),
);

if (untranslated.length === 0) {
  console.log(`i18n OK: ${spanish.size} cadenas, todas traducidas.`);
  process.exit(0);
}

console.error(
  `Quedan ${untranslated.length} cadena(s) en inglés dentro de es.ts:\n` +
    untranslated.map(([k, v]) => `  ${k}: "${v}"`).join("\n"),
);
process.exit(1);
