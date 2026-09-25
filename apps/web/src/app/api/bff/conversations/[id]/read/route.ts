import { apiForward, relay } from "@/lib/api";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return relay(await apiForward(`/conversations/${id}/read`, { method: "PATCH" }));
}
