import { apiForward, relay } from "@/lib/api";

// Mensajes sin leer en toda la bandeja: para el título, el menú y la campana.
export async function GET() {
  return relay(await apiForward("/conversations/unread-count"));
}
