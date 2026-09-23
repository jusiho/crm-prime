import { requireAccessToken } from "@/lib/api";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// Subida de archivos: se reenvía el multipart tal cual, sin tocar el body
// (parsearlo aquí rompería el boundary).
export async function POST(req: Request) {
  const token = await requireAccessToken();
  if (token instanceof Response) return token;

  const res = await fetch(`${API_URL}/api/v1/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // El Content-Type original lleva el boundary del multipart.
      ...(req.headers.get("content-type")
        ? { "Content-Type": req.headers.get("content-type")! }
        : {}),
    },
    body: await req.arrayBuffer(),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
