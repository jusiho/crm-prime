import { apiForward, relay } from "@/lib/api";

type Ctx = { params: Promise<{ id: string; action: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id, action } = await params;
  if (action !== "accept" && action !== "dismiss") {
    return new Response(JSON.stringify({ message: "No encontrado" }), { status: 404 });
  }
  const body = action === "accept" ? await req.text() : undefined;
  return relay(
    await apiForward(`/knowledge/suggestions/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      ...(body ? { body } : {}),
    }),
  );
}
