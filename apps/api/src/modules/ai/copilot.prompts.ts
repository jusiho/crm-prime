import type { ContactMemory, CopilotSummary, RewriteMode } from "@crm/shared";
import { parseLooseJson } from "./prompt-assistant.prompt";

/**
 * Prompts y lectura de respuestas del copiloto. Funciones puras: se prueban
 * sin modelo (test/copilot.test.ts).
 */

const REWRITE_RULES: Record<Exclude<RewriteMode, "translate">, string> = {
  improve:
    "Mejora la redacción: más clara, natural y persuasiva, sin cambiar lo que se ofrece ni inventar datos, precios o promesas.",
  friendly: "Hazlo más cercano y cordial, como alguien amable del equipo. Sin exagerar ni añadir emojis que no estaban.",
  formal: "Hazlo más formal y profesional, trato de usted, sin sonar frío.",
  shorter: "Hazlo más corto: lo esencial en una o dos frases, sin perder ningún dato concreto.",
  grammar: "Corrige solo ortografía, acentos, puntuación y gramática. No cambies el estilo ni el contenido.",
};

/** System prompt para reescribir el borrador del agente humano. */
export function rewriteSystem(mode: RewriteMode, language: string | null, customerSample: string): string {
  const task =
    mode === "translate"
      ? language === "customer" || !language
        ? `Traduce el mensaje al idioma en que escribe el cliente. Estos son sus últimos mensajes, para detectar el idioma:\n"""\n${customerSample || "(sin mensajes)"}\n"""\nSi el cliente escribe en el mismo idioma que el borrador, devuélvelo sin cambios.`
        : `Traduce el mensaje al ${language}, con naturalidad, como lo escribiría un nativo.`
      : REWRITE_RULES[mode];
  return [
    "Eres el copiloto de redacción de un equipo que atiende clientes por WhatsApp.",
    task,
    "Conserva nombres, cifras, precios, enlaces, emojis y saltos de línea tal cual. No añadas emojis que no estaban.",
    "Devuelve SOLO el mensaje final, listo para enviar: sin comillas, sin explicaciones, sin prefijos.",
  ].join("\n");
}

/** Limpia lo que a veces añaden los modelos alrededor del texto. */
export function cleanRewrite(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^(mensaje|respuesta|texto|traducción|versión mejorada)\s*:\s*/i, "");
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("«") && s.endsWith("»"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export const SUMMARY_SYSTEM = [
  "Resume una conversación de WhatsApp entre un negocio y un cliente para que otra persona del equipo la retome en diez segundos.",
  'Responde SOLO con JSON: {"summary": "2-3 frases", "points": ["dato clave", …], "nextStep": "qué hacer ahora" | null, "mood": "positive" | "neutral" | "negative"}.',
  "points: hasta 5, concretos (qué quiere, presupuesto, plazos, objeciones, lo que ya se le prometió). Nada inventado.",
  "Escribe en español.",
].join("\n");

export function parseSummary(raw: string): CopilotSummary {
  const j = parseLooseJson(raw);
  if (!j) {
    return { summary: raw.trim().slice(0, 800), points: [], nextStep: null, mood: null };
  }
  const mood = j.mood === "positive" || j.mood === "neutral" || j.mood === "negative" ? j.mood : null;
  return {
    summary: typeof j.summary === "string" ? j.summary.trim() : "",
    points: Array.isArray(j.points) ? j.points.filter((p): p is string => typeof p === "string" && !!p.trim()).slice(0, 6) : [],
    nextStep: typeof j.nextStep === "string" && j.nextStep.trim() ? j.nextStep.trim() : null,
    mood,
  };
}

export const MEMORY_SYSTEM = [
  "Mantienes la ficha de memoria de un cliente de un negocio que vende por WhatsApp.",
  "Recibes la memoria anterior (puede estar vacía) y conversaciones recientes. Devuelve la memoria actualizada.",
  'Responde SOLO con JSON: {"summary": "1-2 frases de quién es y qué busca", "facts": ["dato estable y útil", …]}.',
  "facts: hasta 8. Solo lo que sirve para atenderle mejor la próxima vez: preferencias, productos que le interesan o compró, presupuesto, ciudad, forma de pago, objeciones, compromisos pendientes.",
  "Si un dato nuevo contradice uno viejo, quédate con el nuevo. Nada de datos sensibles (salud, documentos, tarjetas). Nada inventado.",
  "Escribe en español, en frases cortas.",
].join("\n");

export function parseMemory(raw: string): { summary: string | null; facts: string[] } {
  const j = parseLooseJson(raw);
  if (!j) return { summary: raw.trim().slice(0, 400) || null, facts: [] };
  return {
    summary: typeof j.summary === "string" && j.summary.trim() ? j.summary.trim().slice(0, 500) : null,
    facts: Array.isArray(j.facts)
      ? j.facts.filter((f): f is string => typeof f === "string" && !!f.trim()).map((f) => f.trim().slice(0, 200)).slice(0, 8)
      : [],
  };
}

export function toContactMemory(raw: unknown, at: Date | null): ContactMemory {
  const m = raw && typeof raw === "object" ? (raw as { summary?: unknown; facts?: unknown }) : {};
  return {
    summary: typeof m.summary === "string" ? m.summary : null,
    facts: Array.isArray(m.facts) ? m.facts.filter((f): f is string => typeof f === "string") : [],
    updatedAt: at?.toISOString() ?? null,
  };
}

export function askSystem(context: string): string {
  return [
    "Eres el copiloto de un vendedor que atiende a un cliente por WhatsApp. El vendedor te pregunta sobre este cliente o sobre el negocio.",
    "Responde en español, directo y breve (máximo 6 líneas o una lista corta). Usa solo el contexto de abajo; si no está, dilo claramente en lugar de suponer.",
    "Si te piden redactar un mensaje para el cliente, dáselo listo para copiar.",
    "Texto plano, sin markdown: nada de **, # ni tablas (se lee en un panel pequeño). Para listas usa guiones.",
    "",
    "── CONTEXTO ──",
    context,
  ].join("\n");
}

export const FAQ_GAPS_SYSTEM = [
  "Analizas conversaciones de WhatsApp de un negocio para encontrar preguntas de clientes que su base de conocimiento no responde.",
  "Recibes: los títulos de los documentos que ya existen, preguntas ya detectadas antes (no las repitas), y fragmentos de conversaciones numerados [C1], [C2]…",
  "Agrupa preguntas equivalentes. Ignora saludos, charla, quejas puntuales y preguntas sobre un pedido concreto de un cliente.",
  'Responde SOLO con JSON: {"gaps": [{"question": "pregunta general y reutilizable", "answer": "respuesta a partir de lo que contestó el equipo, o \\"\\" si nadie la respondió bien", "conversations": ["C3", "C7"]}]}',
  "Hasta 8 huecos, los más frecuentes primero. Si no hay huecos, {\"gaps\": []}. Escribe en español.",
].join("\n");

export interface ParsedGap {
  question: string;
  answer: string;
  refs: string[];
}

export function parseGaps(raw: string): ParsedGap[] {
  const j = parseLooseJson(raw);
  const list = j && Array.isArray(j.gaps) ? j.gaps : [];
  const out: ParsedGap[] = [];
  for (const g of list) {
    if (!g || typeof g !== "object") continue;
    const r = g as Record<string, unknown>;
    const question = typeof r.question === "string" ? r.question.trim() : "";
    if (question.length < 5) continue;
    out.push({
      question: question.slice(0, 300),
      // Algunos modelos escriben literalmente "\"\"" cuando no hay respuesta.
      answer: typeof r.answer === "string" ? r.answer.trim().replace(/^(["']{2}|null|-|n\/a)$/i, "").slice(0, 4000) : "",
      refs: Array.isArray(r.conversations) ? r.conversations.filter((c): c is string => typeof c === "string") : [],
    });
  }
  return out.slice(0, 8);
}

/** Normaliza una pregunta para detectar duplicados sin llamar al modelo. */
export function questionKey(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
