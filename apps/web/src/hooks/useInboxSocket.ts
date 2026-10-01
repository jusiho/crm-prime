"use client";

import { useRealtimeCtx } from "@/components/RealtimeProvider";

/**
 * Estado de la conexión en tiempo real. La conexión vive en RealtimeProvider
 * (una para toda la app); aquí solo se consulta.
 */
export function useInboxSocket(): { connected: boolean } {
  const { connected } = useRealtimeCtx();
  return { connected };
}
