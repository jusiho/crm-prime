import { apiForward, relay } from "@/lib/api";

// Estado del registro integrado de WhatsApp: SaaS o no, aprobación de Meta y plan.
export async function GET() {
  return relay(await apiForward("/whatsapp/connect/status"));
}
