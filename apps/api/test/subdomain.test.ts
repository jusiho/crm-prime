/**
 * Qué subdominio de empresa hay en un Host, y cuál no lo es.
 *
 *   npm run test:subdomain --workspace=apps/api
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { subdominioDe, hostDe } from "../src/common/utils/subdomain";

beforeEach(() => {
  process.env.SAAS_BASE_DOMAIN = "driony.com";
});

test("saca el subdominio de una empresa", () => {
  assert.equal(subdominioDe("acme.driony.com"), "acme");
  assert.equal(subdominioDe("Acme.Driony.Com:443"), "acme");
});

test("el dominio raíz y los hosts de infraestructura no son empresas", () => {
  for (const h of ["driony.com", "www.driony.com", "api.driony.com", "app.driony.com", "admin.driony.com"]) {
    assert.equal(subdominioDe(h), undefined, h);
  }
});

test("dos niveles no cuentan: el comodín no los cubre", () => {
  assert.equal(subdominioDe("a.acme.driony.com"), undefined);
});

test("otro dominio que solo se parece, tampoco", () => {
  assert.equal(subdominioDe("acme.driony.com.evil.com"), undefined);
  assert.equal(subdominioDe("nodriony.com"), undefined);
});

test("sin dominio base configurado nunca hay subdominio", () => {
  delete process.env.SAAS_BASE_DOMAIN;
  assert.equal(subdominioDe("acme.driony.com"), undefined);
});

test("hostDe prefiere lo que dejó el proxy", () => {
  assert.equal(hostDe({ host: "web:3000", "x-forwarded-host": "acme.driony.com" }), "acme.driony.com");
  assert.equal(hostDe({ host: "acme.driony.com" }), "acme.driony.com");
  assert.equal(hostDe({}), "");
});
