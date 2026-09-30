import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Descarga de páginas web para la base de conocimiento.
 *
 * El servidor va a pedir una URL que escribe un cliente: sin cuidado, eso es
 * SSRF (pedir http://localhost:3001, http://169.254.169.254 o la base de datos
 * por la red interna de Docker). Por eso cada URL, y cada redirección, se
 * resuelve por DNS y se rechaza si apunta a una dirección que no es pública.
 */

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export class UnsafeUrlError extends Error {}

/** ¿Es una IP de uso interno? (privadas, loopback, enlace local, CGNAT, etc.) */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // enlace local, metadatos de la nube
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast y reservadas
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true;
}

/** Valida la URL y que todas sus IPs sean públicas. Devuelve la URL normalizada. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("La dirección no es válida");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Solo se admiten direcciones http o https");
  }
  if (url.username || url.password) throw new UnsafeUrlError("La dirección no puede llevar usuario ni contraseña");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new UnsafeUrlError("Solo se admiten los puertos web normales (80 y 443)");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UnsafeUrlError("Esa dirección no es pública");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new UnsafeUrlError("No se encontró ese sitio");
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new UnsafeUrlError("Esa dirección no es pública");
  url.hash = "";
  return url;
}

export interface FetchedPage {
  url: string;
  html: string;
}

/** Descarga una página HTML o de texto, siguiendo redirecciones con la misma validación. */
export async function fetchPublicPage(raw: string): Promise<FetchedPage> {
  let current = (await assertPublicUrl(raw)).toString();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": "DrionyKnowledgeBot/1.0 (+https://driony.com)", Accept: "text/html,text/plain" },
      });
    } catch (e) {
      clearTimeout(timer);
      throw new Error((e as Error).name === "AbortError" ? "La página tardó demasiado en responder" : "No se pudo abrir la página");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      current = (await assertPublicUrl(new URL(res.headers.get("location")!, current).toString())).toString();
      continue;
    }
    if (!res.ok) {
      clearTimeout(timer);
      throw new Error(`La página respondió ${res.status}`);
    }
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/.test(type)) {
      clearTimeout(timer);
      throw new Error("No es una página de texto (¿un PDF o una imagen?)");
    }
    const html = await readLimited(res);
    clearTimeout(timer);
    return { url: current, html };
  }
  throw new Error("Demasiadas redirecciones");
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ntilde: "ñ", Ntilde: "Ñ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", iexcl: "¡", iquest: "¿",
  euro: "€", copy: "©", reg: "®", mdash: "—", ndash: "–", hellip: "…", laquo: "«", raquo: "»",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/** Título y texto legible de una página: sin menús, scripts ni estilos. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities(
    (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
      "").replace(/\s+/g, " ").trim(),
  );
  let body = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  body = body
    .replace(/<(script|style|noscript|svg|iframe|template|nav|footer|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|table|ul|ol|blockquote|header)>/gi, "\n\n")
    .replace(/<h([1-6])[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title, text };
}

/** Enlaces del mismo sitio, sin anclas ni archivos, para seguir al rastrear. */
export function sameSiteLinks(html: string, base: string, limit = 50): string[] {
  const origin = new URL(base).origin;
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)) {
    if (m[1]!.startsWith("#")) continue;
    try {
      const u = new URL(decodeEntities(m[1]!), base);
      if (u.origin !== origin) continue;
      if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|docx?|xlsx?|pptx?)$/i.test(u.pathname)) continue;
      u.hash = "";
      out.add(u.toString());
      if (out.size >= limit) break;
    } catch {
      // enlace roto: se ignora
    }
  }
  return [...out];
}
