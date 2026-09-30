import { apiForward, relay } from "@/lib/api";

export async function PUT(req: Request) {
  const body = await req.text();
  return relay(await apiForward("/product-fields/order", { method: "PUT", body }));
}
