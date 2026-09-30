import { apiForward, relay } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.text();
  return relay(await apiForward(`/product-fields/${encodeURIComponent(id)}`, { method: "PATCH", body }));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return relay(await apiForward(`/product-fields/${encodeURIComponent(id)}`, { method: "DELETE" }));
}
