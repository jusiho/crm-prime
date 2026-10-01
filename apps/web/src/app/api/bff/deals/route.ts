import { apiForward, relay } from "@/lib/api";

// Oportunidades abiertas de un contacto: ?contactId=<id>
export async function GET(req: Request) {
  const { search } = new URL(req.url);
  return relay(await apiForward(`/deals${search}`));
}

export async function POST(req: Request) {
  const body = await req.text();
  return relay(await apiForward("/deals", { method: "POST", body }));
}
