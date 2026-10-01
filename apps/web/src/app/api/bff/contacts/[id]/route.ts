import { apiForward, relay } from "@/lib/api";

// Ficha de un contacto (la del panel de la bandeja).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return relay(await apiForward(`/contacts/${id}`));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.text();
  return relay(await apiForward(`/contacts/${id}`, { method: "PATCH", body }));
}
