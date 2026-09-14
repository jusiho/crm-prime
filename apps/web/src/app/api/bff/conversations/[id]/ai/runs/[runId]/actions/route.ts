import { apiForward, relay } from "@/lib/api";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const { id, runId } = await params;
  const body = await req.text();
  return relay(
    await apiForward(`/conversations/${id}/ai/runs/${runId}/actions`, {
      method: "POST",
      body,
    }),
  );
}
