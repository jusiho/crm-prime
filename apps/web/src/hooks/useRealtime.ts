"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { fetchRealtimeToken } from "@/lib/bff";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Reintentos al pedir el token: la API puede estar reiniciándose o la sesión
// puede necesitar refrescar su access token antes de responder.
const RETRY_DELAYS_MS = [1_000, 3_000, 8_000, 20_000];

/**
 * Conecta al gateway de Socket.io con un token de realtime de corta vida y
 * registra los handlers indicados. El JWT principal nunca sale del servidor.
 *
 * Si el token no se puede obtener (API caída, 401 transitorio mientras
 * NextAuth refresca la sesión), reintenta con espera creciente en vez de
 * quedarse sin conexión para siempre.
 */
export function useRealtime(
  handlers: Record<string, (payload: unknown) => void>,
): { connected: boolean } {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  // Mantener los handlers en un ref para no reconectar en cada render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect(attempt = 0): Promise<void> {
      let token: string;
      try {
        token = await fetchRealtimeToken();
      } catch {
        if (!active) return;
        // Agotados los reintentos, se deja de insistir: la próxima navegación
        // (o recarga) vuelve a montar el hook y lo intenta de nuevo.
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) return;
        retryTimer = setTimeout(() => {
          if (active) void connect(attempt + 1);
        }, delay);
        return;
      }
      if (!active) return;

      const socket = io(API_URL, { auth: { token }, transports: ["websocket"] });
      socketRef.current = socket;
      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));
      socket.onAny((event: string, payload: unknown) => {
        handlersRef.current[event]?.(payload);
      });
    }

    void connect();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { connected };
}
