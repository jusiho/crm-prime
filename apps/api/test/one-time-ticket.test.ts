/**
 * Pases firmados de un solo uso.
 *
 * Viajan en la URL, así que la regla que importa es la negativa: un pase no
 * vale dos veces, no vale para otro propósito, y manipulado no vale nada.
 *
 *   npm run test:tickets --workspace=apps/api
 */
import test, { before } from "node:test";
import assert from "node:assert/strict";
import { JwtService } from "@nestjs/jwt";
import { OneTimeTicketService } from "../src/infra/tickets/one-time-ticket.service";

let svc: OneTimeTicketService;

before(() => {
  process.env.JWT_ACCESS_SECRET = "secreto-de-prueba";
  svc = new OneTimeTicketService(new JwtService({}));
});

test("un pase se canjea una vez y devuelve sus datos", async () => {
  const pase = await svc.issue("prueba", { sub: "u1", org: "o1" }, "2m");
  const claims = await svc.redeem<{ org: string }>("prueba", pase);
  assert.equal(claims.sub, "u1");
  assert.equal(claims.org, "o1");
  assert.equal(claims.purpose, "prueba");
});

test("el mismo pase no vale dos veces", async () => {
  const pase = await svc.issue("prueba", { sub: "u1" }, "2m");
  await svc.redeem("prueba", pase);
  await assert.rejects(() => svc.redeem("prueba", pase), /ya se usó/);
});

test("un pase de otro propósito no vale", async () => {
  const pase = await svc.issue("alta", { sub: "u1" }, "2m");
  await assert.rejects(() => svc.redeem("whatsapp-connect", pase), /no es válido/);
});

test("un pase manipulado no vale", async () => {
  const pase = await svc.issue("prueba", { sub: "u1" }, "2m");
  await assert.rejects(() => svc.redeem("prueba", pase + "x"), /caducado o no es válido/);
});

test("un pase caducado no vale", async () => {
  const pase = await svc.issue("prueba", { sub: "u1" }, "1ms");
  await new Promise((r) => setTimeout(r, 20));
  await assert.rejects(() => svc.redeem("prueba", pase), /caducado o no es válido/);
});
