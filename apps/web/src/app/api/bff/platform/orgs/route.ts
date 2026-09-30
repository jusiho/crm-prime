import { apiForward, relay } from "@/lib/api";

export async function GET(req: Request) {
  const search = new URL(req.url).searchParams.get("search") ?? "";
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return relay(await apiForward(`/platform/orgs${qs}`));
}
