/**
 * Panel: utilidades de fecha y zona horaria (lo que decide qué es "hoy").
 *
 *   npm run test:dashboard --workspace=apps/api
 */
import test from "node:test";
import assert from "node:assert/strict";
import { localDay, median, safeTimeZone } from "../src/modules/dashboard/dashboard.service";

test("la zona horaria solo acepta nombres IANA válidos", () => {
  assert.equal(safeTimeZone("America/Lima"), "America/Lima");
  assert.equal(safeTimeZone("America/Argentina/Buenos_Aires"), "America/Argentina/Buenos_Aires");
  assert.equal(safeTimeZone("UTC"), "UTC");
  assert.equal(safeTimeZone(undefined), "UTC");
  assert.equal(safeTimeZone("Marte/Olympus"), "UTC", "inexistente");
  assert.equal(safeTimeZone("'; DROP TABLE deals; --"), "UTC", "inyección");
});

test("el día local depende de la zona: las 02:00 UTC aún son ayer en Lima", () => {
  const d = new Date("2026-09-30T02:00:00Z");
  assert.equal(localDay(d, "UTC"), "2026-09-30");
  assert.equal(localDay(d, "America/Lima"), "2026-09-29");
  assert.equal(localDay(d, "Europe/Madrid"), "2026-09-30");
});

test("mediana del tiempo de respuesta", () => {
  assert.equal(median([]), null);
  assert.equal(median([5]), 5);
  assert.equal(median([30, 10, 20]), 20);
  assert.equal(median([10, 20, 30, 40]), 25);
});
