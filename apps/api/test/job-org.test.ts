/**
 * Contexto de empresa en los trabajos de cola.
 *
 * Un worker no tiene petición detrás: la empresa viaja en el trabajo o se
 * deduce del dato. Lo que se comprueba aquí es la regla de fallo: en SaaS, un
 * trabajo sin empresa NO se procesa. Silenciarlo escribiría datos de un
 * cliente en la empresa equivocada.
 *
 * Cada caso corre en un subproceso con su TENANCY_MODE, porque el modo se lee
 * al importar y no se puede cambiar en caliente.
 *
 *   npm run test:joborg --workspace=apps/api
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

function corre(modo: "single" | "multi", orgId: string | null) {
  const out = execFileSync("npx", ["tsx", "test/fixtures/joborg-run.ts", orgId ?? "null"], {
    env: { ...process.env, TENANCY_MODE: modo },
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return JSON.parse(out.trim().split("\n").pop()!) as { ok: boolean; v?: string | null; msg?: string };
}

test("con orgId, el trabajo corre dentro de esa empresa", () => {
  const r = corre("multi", "org_a");
  assert.equal(r.ok, true);
  assert.equal(r.v, "org_a");
});

test("en SaaS, un trabajo sin empresa falla con un motivo legible", () => {
  const r = corre("multi", null);
  assert.equal(r.ok, false);
  assert.match(r.msg ?? "", /envío: trabajo sin organización/);
});

test("con una sola empresa, un trabajo sin empresa sigue procesándose", () => {
  const r = corre("single", null);
  assert.equal(r.ok, true);
});
