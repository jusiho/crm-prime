import { apiForward, relay } from "@/lib/api";

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status");
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return relay(await apiForward(`/meta/leads${qs}`));
}
