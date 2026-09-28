import { apiForward, relay } from "@/lib/api";

export async function POST() {
  return relay(await apiForward("/onboarding/dismiss", { method: "POST" }));
}

export async function DELETE() {
  return relay(await apiForward("/onboarding/dismiss", { method: "DELETE" }));
}
