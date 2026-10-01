import { apiForward, relay } from "@/lib/api";

// Etiquetas del contacto como conjunto final: { tags: string[] }.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.text();
  return relay(await apiForward(`/contacts/${id}/tags`, { method: "PUT", body }));
}
