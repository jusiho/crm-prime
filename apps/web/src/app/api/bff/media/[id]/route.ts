import { requireAccessToken } from "@/lib/api";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// Sirve el binario al navegador, añadiendo el JWT que el cliente no tiene.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await requireAccessToken();
  if (token instanceof Response) return token;

  const res = await fetch(`${API_URL}/api/v1/media/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return new Response("No encontrado", { status: res.status });

  return new Response(await res.arrayBuffer(), {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
