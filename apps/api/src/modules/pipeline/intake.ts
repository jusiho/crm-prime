/**
 * Reglas puras de la entrada automática al embudo. Van aparte del servicio
 * para poder probarlas sin base de datos.
 */

/**
 * Entre los vendedores candidatos, el que menos oportunidades abiertas tiene
 * en el embudo. Con empate, el primero de la lista (que es el orden de
 * asignación a la fuente). Reparte parejo sin necesitar memoria de turnos.
 */
export function pickLeastLoaded(
  candidates: string[],
  openByOwner: Map<string, number>,
): string | null {
  let best: string | null = null;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const id of candidates) {
    const n = openByOwner.get(id) ?? 0;
    if (n < bestCount) {
      best = id;
      bestCount = n;
    }
  }
  return best;
}

export interface LastDeal {
  discardedAt: Date | null;
  discardReason: string | null;
  stage: { isWon: boolean; isLost: boolean; pipelineId: string };
}

/**
 * Qué hacer con un contacto que escribe, según su última oportunidad:
 *
 *   - abierta y en curso  → nada, ya se está trabajando;
 *   - descartada por inactividad en este mismo embudo → vuelve (respondió);
 *   - ganada, perdida, descartada a mano o inexistente → una nueva.
 */
export function decideIntake(
  last: LastDeal | null,
  pipelineId: string,
): "skip" | "restore" | "create" {
  if (!last) return "create";
  if (!last.discardedAt && !last.stage.isWon && !last.stage.isLost) return "skip";
  if (
    last.discardedAt &&
    last.discardReason === "auto" &&
    last.stage.pipelineId === pipelineId
  ) {
    return "restore";
  }
  return "create";
}
