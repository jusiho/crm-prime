/**
 * Normalización de teléfonos a E.164 (`+` seguido de 7-15 dígitos).
 *
 * Existe porque los números llegan por vías con formatos distintos y, sin
 * unificarlos, el MISMO cliente se duplica: la Cloud API de Meta manda el
 * `wa_id` sin `+` (`5215512345678`), mientras que el alta manual y los
 * webhooks de leads suelen traerlo con `+`, con espacios o con guiones.
 * Como `Contact.phone` es único, ambos formatos crean dos contactos.
 *
 * Ojo: esto arregla el FORMATO, no el prefijo de país. Un número nacional
 * suelto ("5512345678") no se puede completar sin saber el país, así que se
 * queda como "+5512345678"; `isValidPhone` solo comprueba la forma.
 */

export function normalizePhone(raw: string): string {
  // "00" inicial es la marcación internacional: equivale al "+".
  const trimmed = raw.trim().replace(/^00/, "+");
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

// E.164: "+", un primer dígito no nulo y entre 7 y 15 dígitos en total.
const E164 = /^\+[1-9]\d{6,14}$/;

export function isValidPhone(value: string): boolean {
  return E164.test(value);
}

/**
 * Clave comparable de un número (solo dígitos), para detectar que dos
 * contactos escritos distinto son en realidad el mismo.
 */
export function phoneKey(raw: string): string {
  return raw.replace(/\D/g, "");
}
