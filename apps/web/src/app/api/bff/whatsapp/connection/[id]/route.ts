import { apiForward, relay } from "@/lib/api";

// Configuración de un número: alias, embudo de entrada y agente de IA.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.text();
  return relay(await apiForward(`/whatsapp/connection/${id}`, { method: "PATCH", body }));
}
