"use server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export type ConnectResult = { ok: true; returnUrl: string } | { ok: false; error: string };

/**
 * Entrega a la API el resultado del Embedded Signup junto con el pase.
 * Es una acción de servidor para no exponer la API al navegador desde aquí:
 * el conector vive en el dominio raíz y no tiene sesión.
 */
export async function connectWithTicket(input: {
  ticket: string;
  code: string;
  phoneNumberId: string;
  wabaId?: string;
}): Promise<ConnectResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/whatsapp/connect/with-ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, mode: "coexistence" }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "No hay conexión con el servidor. Inténtalo de nuevo." };
  }
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(b.message) ? b.message[0] : b.message;
    return { ok: false, error: msg ?? "No se pudo conectar el número" };
  }
  const r = (await res.json()) as { returnUrl: string };
  return { ok: true, returnUrl: r.returnUrl };
}
