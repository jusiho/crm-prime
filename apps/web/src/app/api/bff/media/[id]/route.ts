import { auth } from "@/auth";
import { sessionExpiredResponse } from "@/lib/api";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// Sirve el binario al navegador, añadiendo el JWT que el cliente no tiene.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  if (!token || (session as { error?: string } | null)?.error === "RefreshError") {
    return sessionExpiredResponse();
  }

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
