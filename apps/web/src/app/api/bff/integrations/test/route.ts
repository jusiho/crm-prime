import { apiForward, relay } from "@/lib/api";

export async function POST() {
  return relay(
    await apiForward("/integrations/settings/test", { method: "POST" }),
  );
}
