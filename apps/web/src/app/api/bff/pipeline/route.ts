import { apiForward, relay } from "@/lib/api";

// Tablero de un embudo: ?id=<embudo>&view=open|discarded
export async function GET(req: Request) {
  const { search } = new URL(req.url);
  return relay(await apiForward(`/pipeline${search}`));
}
