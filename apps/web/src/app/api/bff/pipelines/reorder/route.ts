import { apiForward, relay } from "@/lib/api";

export async function PATCH(req: Request) {
  const body = await req.text();
  return relay(await apiForward("/pipelines/reorder", { method: "PATCH", body }));
}
