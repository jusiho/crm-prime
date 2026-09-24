/**
 * Qué subdominio de empresa hay en un Host, y cuál no lo es.
 *
 *   npm run test:subdomain --workspace=apps/api
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { subdominioDe, hostDe } from "../src/common/utils/subdomain";

beforeEach(() => {
  process.env.SAAS_BASE_DOMAIN = "trimmo.lat";
});

test("saca el subdominio de una empresa", () => {
  assert.equal(subdominioDe("acme.trimmo.lat"), "acme");
  assert.equal(subdominioDe("Acme.Trimmo.Lat:443"), "acme");
});

test("el dominio raíz y los hosts de infraestructura no son empresas", () => {
  for (const h of ["trimmo.lat", "www.trimmo.lat", "api.trimmo.lat", "app.trimmo.lat", "admin.trimmo.lat"]) {
    assert.equal(subdominioDe(h), undefined, h);
  }
});

test("dos niveles no cuentan: el comodín no los cubre", () => {
  assert.equal(subdominioDe("a.acme.trimmo.lat"), undefined);
});

test("otro dominio que solo se parece, tampoco", () => {
  assert.equal(subdominioDe("acme.trimmo.lat.evil.com"), undefined);
  assert.equal(subdominioDe("notrimmo.lat"), undefined);
});

test("sin dominio base configurado nunca hay subdominio", () => {
  delete process.env.SAAS_BASE_DOMAIN;
  assert.equal(subdominioDe("acme.trimmo.lat"), undefined);
});

test("hostDe prefiere lo que dejó el proxy", () => {
  assert.equal(hostDe({ host: "web:3000", "x-forwarded-host": "acme.trimmo.lat" }), "acme.trimmo.lat");
  assert.equal(hostDe({ host: "acme.trimmo.lat" }), "acme.trimmo.lat");
  assert.equal(hostDe({}), "");
});
