import { apiForward, relay } from "@/lib/api";

type Params = { params: Promise<{ key: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { key } = await params;
  return relay(await apiForward(`/onboarding/steps/${encodeURIComponent(key)}/skip`, { method: "POST" }));
}

export async function DELETE(_req: Request, { params }: Params) {
  const { key } = await params;
  return relay(await apiForward(`/onboarding/steps/${encodeURIComponent(key)}/skip`, { method: "DELETE" }));
}
