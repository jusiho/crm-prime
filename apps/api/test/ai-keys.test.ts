/**
 * De quién es la API key de IA que usa una empresa.
 *
 * Con una sola empresa, el .env es suyo y sirve de respaldo. En SaaS el .env
 * es de la plataforma: una empresa sin key propia NO la hereda —quedaría el
 * operador pagando la IA de todos sin saberlo— salvo que lo pida con
 * AI_SHARED_KEYS=true. Una key propia guardada gana siempre.
 *
 * Cada caso corre en un subproceso con su TENANCY_MODE, porque el modo se lee
 * al importar y no se puede cambiar en caliente.
 *
 *   npm run test:aikeys --workspace=apps/api
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

function corre(modo: "single" | "multi", compartidas: boolean, propia: "db" | "none") {
  const out = execFileSync("npx", ["tsx", "test/fixtures/ai-keys-run.ts", propia], {
    env: {
      ...process.env,
      TENANCY_MODE: modo,
      AI_SHARED_KEYS: compartidas ? "true" : "",
      OPENAI_API_KEY: "sk-de-la-plataforma",
      ANTHROPIC_API_KEY: "",
      APP_ENCRYPTION_KEY: "clave-de-prueba-para-cifrar-secretos",
    },
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return JSON.parse(out.trim().split("\n").pop()!) as {
    ok: boolean;
    source?: "db" | "env" | "none";
    active?: string;
    platformKeys?: boolean;
    saas?: boolean;
  };
}

test("SaaS: sin key propia y sin préstamo, la empresa no hereda la key de la plataforma", () => {
  const r = corre("multi", false, "none");
  assert.equal(r.ok, true);
  assert.equal(r.source, "none");
  assert.equal(r.active, "fake");
  assert.equal(r.platformKeys, false);
  assert.equal(r.saas, true);
});

test("SaaS: con AI_SHARED_KEYS=true la key de la plataforma sirve de respaldo", () => {
  const r = corre("multi", true, "none");
  assert.equal(r.source, "env");
  assert.equal(r.active, "openai");
  assert.equal(r.platformKeys, true);
});

test("SaaS: la key propia de la empresa gana aunque no haya préstamo", () => {
  const r = corre("multi", false, "db");
  assert.equal(r.source, "db");
  assert.equal(r.active, "openai");
});

test("una sola empresa: el .env sigue siendo su respaldo, como siempre", () => {
  const r = corre("single", false, "none");
  assert.equal(r.source, "env");
  assert.equal(r.platformKeys, true);
  assert.equal(r.saas, false);
});
