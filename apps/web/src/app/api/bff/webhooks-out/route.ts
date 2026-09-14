import { apiForward, relay } from "@/lib/api";

export async function GET() {
  return relay(await apiForward("/webhooks-out"));
}

export async function POST(req: Request) {
  const body = await req.text();
  return relay(await apiForward("/webhooks-out", { method: "POST", body }));
}
