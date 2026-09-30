"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAiStatus } from "@/lib/bff";

/**
 * ¿Hay IA con clave en esta empresa? El copiloto se ofrece solo si la hay:
 * Driony no presta créditos, cada empresa usa su propia clave.
 */
export function useAiStatus() {
  return useQuery({ queryKey: ["ai-status"], queryFn: fetchAiStatus, staleTime: 60_000 });
}

export const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  fake: "IA simulada",
};
