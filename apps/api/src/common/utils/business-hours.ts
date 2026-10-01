import type { BusinessHours } from "@crm/shared";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * ¿Estamos dentro del horario de atención? Se usa en el agente de IA (fuera
 * de horario no responde) y en el bloque «Horario» de los flujos.
 * Una zona horaria inválida no bloquea: se asume dentro de horario.
 */
export function isWithinHours(hours: BusinessHours, at: Date = new Date()): boolean {
  const tz = hours.timezone || "America/Lima";
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(at);
  } catch {
    return true;
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const local = new Date(at.toLocaleString("en-US", { timeZone: tz }));
  const day = WEEKDAYS[local.getDay()]!;
  const range = hours.days?.[day];
  if (!range) return false; // día cerrado

  // "24" aparece en algunos motores a medianoche con hour12: false.
  const hh = get("hour").padStart(2, "0").replace("24", "00");
  const mm = get("minute").padStart(2, "0");
  const now = `${hh}:${mm}`;
  return now >= range.from && now <= range.to;
}
