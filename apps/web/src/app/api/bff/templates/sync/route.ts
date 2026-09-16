import { apiForward, relay } from "@/lib/api";

export async function POST() {
  return relay(await apiForward("/templates/sync", { method: "POST" }));
}
