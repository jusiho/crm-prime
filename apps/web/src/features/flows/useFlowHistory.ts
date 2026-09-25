"use client";

import { useCallback, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";

export interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Deshacer / rehacer del lienzo.
 *
 * Quien va a mutar llama a `record(estadoActual)` ANTES de cambiar nada; así
 * el historial guarda "cómo estaba". Las ediciones seguidas con la misma
 * `key` (teclear en el mismo campo) se agrupan en una sola entrada, para que
 * deshacer no vaya letra a letra.
 */
export function useFlowHistory(limit = 60) {
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const lastKey = useRef<string | null>(null);
  const lastAt = useRef(0);
  // Solo para que los botones se re-rendericen cuando cambia el historial.
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const record = useCallback(
    (snap: Snapshot, key?: string) => {
      const now = Date.now();
      if (key && key === lastKey.current && now - lastAt.current < 1200) {
        lastAt.current = now;
        return;
      }
      lastKey.current = key ?? null;
      lastAt.current = now;
      past.current.push(snap);
      if (past.current.length > limit) past.current.shift();
      future.current = [];
      bump();
    },
    [limit, bump],
  );

  const undo = useCallback(
    (current: Snapshot): Snapshot | null => {
      const prev = past.current.pop();
      if (!prev) return null;
      future.current.push(current);
      lastKey.current = null;
      bump();
      return prev;
    },
    [bump],
  );

  const redo = useCallback(
    (current: Snapshot): Snapshot | null => {
      const next = future.current.pop();
      if (!next) return null;
      past.current.push(current);
      lastKey.current = null;
      bump();
      return next;
    },
    [bump],
  );

  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
    lastKey.current = null;
    bump();
  }, [bump]);

  return {
    record,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
