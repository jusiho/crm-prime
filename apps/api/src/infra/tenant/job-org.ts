import { runInOrg, tenancyMode } from "./tenant.context";

/**
 * Abre el contexto de empresa para un trabajo de cola.
 *
 * Un worker no tiene petición HTTP detrás, así que el `orgId` no viene de
 * ningún token: tiene que viajar en el propio trabajo (lo pone quien lo
 * encola, que sí tiene contexto) o deducirse del dato que el trabajo señala
 * (el mensaje, la conversación, la página de Meta…).
 *
 * Si no hay forma de saberlo, en modo SaaS el trabajo **falla**. Procesarlo
 * "a ver qué pasa" escribiría datos de un cliente en la empresa equivocada, y
 * eso es peor que un job en la cola de fallidos con un motivo legible.
 *
 * En modo de una sola empresa se sigue sin contexto: la organización única
 * hace de respaldo y todo funciona como siempre.
 */
export async function runJobInOrg<T>(
  que: string,
  orgId: string | null | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (orgId) return runInOrg(orgId, fn);
  if (tenancyMode === "multi") {
    throw new Error(`${que}: trabajo sin organización, no se puede procesar`);
  }
  return fn();
}
