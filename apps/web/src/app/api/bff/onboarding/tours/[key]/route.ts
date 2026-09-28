import { apiForward, relay } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return relay(await apiForward(`/onboarding/tours/${encodeURIComponent(key)}`, { method: "POST" }));
}
