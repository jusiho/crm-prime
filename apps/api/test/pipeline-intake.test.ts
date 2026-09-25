/**
 * Reglas de la entrada automática al embudo (sin base de datos).
 *
 *   npm run test:intake --workspace=apps/api
 */
import test from "node:test";
import assert from "node:assert/strict";
import { decideIntake, pickLeastLoaded } from "../src/modules/pipeline/intake";

const etapa = (o: Partial<{ isWon: boolean; isLost: boolean; pipelineId: string }> = {}) => ({
  isWon: false,
  isLost: false,
  pipelineId: "ventas",
  ...o,
});

test("sin oportunidad previa se crea una", () => {
  assert.equal(decideIntake(null, "ventas"), "create");
});

test("con una oportunidad en curso no se hace nada", () => {
  assert.equal(
    decideIntake({ discardedAt: null, discardReason: null, stage: etapa() }, "ventas"),
    "skip",
  );
});

test("ganada o perdida: el contacto vuelve a empezar con una nueva", () => {
  assert.equal(
    decideIntake({ discardedAt: null, discardReason: null, stage: etapa({ isWon: true }) }, "ventas"),
    "create",
  );
  assert.equal(
    decideIntake({ discardedAt: null, discardReason: null, stage: etapa({ isLost: true }) }, "ventas"),
    "create",
  );
});

test("descartada por inactividad en el mismo embudo: vuelve, porque respondió", () => {
  assert.equal(
    decideIntake({ discardedAt: new Date(), discardReason: "auto", stage: etapa() }, "ventas"),
    "restore",
  );
});

test("descartada a mano, o de otro embudo: una nueva", () => {
  assert.equal(
    decideIntake({ discardedAt: new Date(), discardReason: "manual", stage: etapa() }, "ventas"),
    "create",
  );
  assert.equal(
    decideIntake(
      { discardedAt: new Date(), discardReason: "auto", stage: etapa({ pipelineId: "soporte" }) },
      "ventas",
    ),
    "create",
  );
});

test("el reparto va al vendedor con menos oportunidades abiertas; en empate, el primero", () => {
  const carga = new Map([
    ["ana", 3],
    ["bea", 1],
    ["carlos", 1],
  ]);
  assert.equal(pickLeastLoaded(["ana", "bea", "carlos"], carga), "bea");
  assert.equal(pickLeastLoaded(["ana", "dani"], carga), "dani"); // sin oportunidades = 0
  assert.equal(pickLeastLoaded([], carga), null);
});
