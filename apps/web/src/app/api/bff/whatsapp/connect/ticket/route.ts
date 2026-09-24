import { apiForward, relay } from "@/lib/api";

// Pide a la API el pase para el conector de WhatsApp (dominio fijo).
export async function POST() {
  return relay(await apiForward("/whatsapp/connect/ticket", { method: "POST" }));
}
