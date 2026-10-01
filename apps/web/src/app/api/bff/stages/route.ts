import { apiForward, relay } from "@/lib/api";

// Etapas de todos los embudos (con el nombre de cada embudo).
export async function GET() {
  return relay(await apiForward("/stages"));
}

export async function POST(req: Request) {
  const body = await req.text();
  return relay(await apiForward("/stages", { method: "POST", body }));
}
