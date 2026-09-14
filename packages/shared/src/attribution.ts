/**
 * Atribución de marketing: de qué anuncio o campaña viene un contacto.
 *
 * Hay dos vías distintas y conviene no confundirlas:
 *
 *  1. Anuncios Click-to-WhatsApp: Meta adjunta un objeto `referral` al primer
 *     mensaje de la conversación. NO trae utm_*; trae el id del anuncio y el
 *     `ctwa_clid`, que es lo que permite devolver conversiones a Meta.
 *  2. Enlaces wa.me con texto prellenado (`wa.me/519...?text=Hola utm_source=ig`):
 *     ahí sí viajan los utm_*, pero dentro del texto del mensaje, así que hay
 *     que extraerlos y limpiar el texto para que el agente no vea el churro.
 */

// ── 1. Anuncio Click-to-WhatsApp ─────────────────────────────
export interface AdReferral {
  sourceUrl: string | null;
  sourceId: string | null; // id del anuncio
  sourceType: string | null; // ad | post
  headline: string | null;
  body: string | null;
  mediaType: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  ctwaClid: string | null; // click id (Conversions API)
  welcomeMessage: string | null;
}

// Etiqueta corta para mostrar en la UI: el titular, o el id del anuncio.
export function adReferralLabel(r: AdReferral): string {
  return r.headline?.trim() || r.sourceId?.trim() || "Anuncio";
}

// ── 2. UTMs en el texto del primer mensaje ───────────────────
export const utmKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
export type UtmKey = (typeof utmKeys)[number];

export type Utms = Partial<Record<UtmKey, string>>;

// Acepta las formas en que suele llegar el texto prellenado:
//   "Hola utm_source=ig&utm_campaign=verano"
//   "Hola ?utm_source=ig&utm_campaign=verano"
//   "Hola [utm_source=ig|utm_campaign=verano]"
const UTM_PAIR = new RegExp(`\\b(${utmKeys.join("|")})\\s*[=:]\\s*([^\\s&|,;\\]]+)`, "gi");

export interface ParsedUtms {
  utms: Utms;
  /** El mensaje sin los parámetros, para mostrarlo limpio en el chat. */
  cleanText: string;
}

/**
 * UTMs en la query de una URL. En los anuncios se pueden configurar
 * "parámetros de URL", y cuando los hay acaban en el `source_url` del
 * referral; si no, esto simplemente no encuentra nada.
 */
export function utmsFromUrl(url: string | undefined | null): Utms {
  if (!url) return {};
  const query = url.split("?")[1];
  if (!query) return {};

  const utms: Utms = {};
  for (const part of query.split("&")) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim().toLowerCase();
    if (!key || !(utmKeys as readonly string[]).includes(key)) continue;
    const raw = rest.join("=");
    if (!raw) continue;
    try {
      utms[key as UtmKey] = decodeURIComponent(raw.replace(/\+/g, " ")).slice(0, 120);
    } catch {
      utms[key as UtmKey] = raw.slice(0, 120);
    }
  }
  return utms;
}

export function parseUtms(text: string | undefined | null): ParsedUtms {
  if (!text) return { utms: {}, cleanText: text ?? "" };

  const utms: Utms = {};
  for (const match of text.matchAll(UTM_PAIR)) {
    const key = match[1]?.toLowerCase() as UtmKey | undefined;
    const value = match[2];
    if (key && value && !utms[key]) {
      utms[key] = decodeURIComponent(value).slice(0, 120);
    }
  }
  if (Object.keys(utms).length === 0) return { utms: {}, cleanText: text };

  // Quitar los pares y solo los separadores de parámetros ("?", "&", "|"),
  // nunca la puntuación normal del mensaje: "Hola, quiero info" conserva
  // su coma.
  const cleanText =
    text
      .replace(UTM_PAIR, "")
      .replace(/[?&|]+/g, " ")
      .replace(/\[\s*\]|\(\s*\)/g, "")
      // Separadores que quedaron colgando al final tras borrar los pares.
      .replace(/[\s,;]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim() || text.trim();

  return { utms, cleanText };
}
