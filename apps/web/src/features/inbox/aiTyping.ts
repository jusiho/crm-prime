"use client";

import { useSyncExternalStore } from "react";

/**
 * «La IA está escribiendo» por conversación. Lo enciende y lo apaga el
 * servidor (evento `ai.typing` del socket) cuando el autopilot empieza y
 * termina de redactar, así no se queda encendido cuando la IA decide no
 * contestar (escalado, fuera de horario, sin clave…).
 *
 * Por si un «apagar» se pierde (socket caído a mitad), un encendido caduca
 * solo pasado un rato más largo que cualquier respuesta razonable.
 */
const MAX_MS = 90_000;

const startedAt = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version++;
  for (const l of listeners) l();
}

export function setAiTyping(conversationId: string, on: boolean): void {
  if (on) startedAt.set(conversationId, Date.now());
  else startedAt.delete(conversationId);
  emit();
}

function isTyping(conversationId: string): boolean {
  const since = startedAt.get(conversationId);
  if (since === undefined) return false;
  if (Date.now() - since > MAX_MS) {
    startedAt.delete(conversationId);
    return false;
  }
  return true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Para que la caducidad se note sin esperar otro evento.
  const timer = setInterval(() => {
    let caducado = false;
    for (const [id, since] of startedAt) {
      if (Date.now() - since > MAX_MS) {
        startedAt.delete(id);
        caducado = true;
      }
    }
    if (caducado) emit();
  }, 5_000);
  return () => {
    listeners.delete(listener);
    clearInterval(timer);
  };
}

/** Si la IA está redactando ahora mismo en esta conversación. */
export function useAiTyping(conversationId: string): boolean {
  // La versión fuerza una lectura nueva tras cada evento; el valor leído es el booleano.
  useSyncExternalStore(subscribe, () => version, () => 0);
  return isTyping(conversationId);
}
