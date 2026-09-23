/**
 * Qué orígenes acepta la API.
 *
 * Con subdominios por empresa, CORS deja de ser una lista fija: cada alta crea
 * un origen nuevo. Lo que se comprueba aquí es que se acepte lo justo — y sobre
 * todo, que NO se acepte lo que se parece.
 *
 *   npm run test:cors --workspace=apps/api
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../src/common/utils/cors-origin";

beforeEach(() => {
  delete process.env.WEB_ORIGIN;
  delete process.env.SAAS_BASE_DOMAIN;
});

test("sin cabecera Origin se deja pasar (no es un navegador)", () => {
  // El webhook de Meta y las llamadas servidor a servidor caen aquí.
  process.env.SAAS_BASE_DOMAIN = "trimmo.lat";
  assert.equal(isAllowedOrigin(undefined), true);
  assert.equal(isAllowedOrigin(null), true);
});

test("acepta el dominio base y cualquier subdominio de empresa", () => {
  process.env.SAAS_BASE_DOMAIN = "trimmo.lat";
  for (const o of [
    "https://trimmo.lat",
    "https://acme.trimmo.lat",
    "https://globex.trimmo.lat",
    "https://empresa-con-guion.trimmo.lat",
  ]) {
    assert.equal(isAllowedOrigin(o), true, `debería aceptar ${o}`);
  }
});

test("rechaza dominios que solo SE PARECEN al nuestro", () => {
  process.env.SAAS_BASE_DOMAIN = "trimmo.lat";
  const impostores = [
    "https://trimmo.lat.atacante.com", // el clásico: termina en otra cosa
    "https://notrimmo.lat",            // sin el punto separador
    "https://acme.trimmo.lat.evil.co",
    "https://evil.com",
  ];
  for (const o of impostores) {
    assert.equal(isAllowedOrigin(o), false, `NO debería aceptar ${o}`);
  }
});

test("rechaza subdominios de segundo nivel (el comodín tampoco los cubre)", () => {
  process.env.SAAS_BASE_DOMAIN = "trimmo.lat";
  assert.equal(isAllowedOrigin("https://algo.acme.trimmo.lat"), false);
});

test("WEB_ORIGIN sigue valiendo para orígenes de fuera del dominio", () => {
  process.env.SAAS_BASE_DOMAIN = "trimmo.lat";
  process.env.WEB_ORIGIN = "https://panel.otrodominio.com";
  assert.equal(isAllowedOrigin("https://panel.otrodominio.com"), true);
  assert.equal(isAllowedOrigin("https://otro.otrodominio.com"), false);
});

test("sin configurar nada sigue abierto, para no romper desarrollo", () => {
  assert.equal(isAllowedOrigin("http://localhost:3000"), true);
});

test("con WEB_ORIGIN y sin dominio base, solo vale la lista", () => {
  process.env.WEB_ORIGIN = "https://midominio.com";
  assert.equal(isAllowedOrigin("https://midominio.com"), true);
  assert.equal(isAllowedOrigin("https://otro.com"), false);
});
