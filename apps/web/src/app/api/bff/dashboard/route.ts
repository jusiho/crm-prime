import { apiForward, relay } from "@/lib/api";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const qs = new URLSearchParams();
  for (const k of ["period", "tz", "pipelineId"]) {
    const v = sp.get(k);
    if (v) qs.set(k, v);
  }
  return relay(await apiForward(`/dashboard?${qs.toString()}`));
}
