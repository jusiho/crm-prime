/**
 * Un webhook que entra por la ruta de una empresa (su propia app de Meta,
 * `acme.trimmo.lat/api/v1/webhooks/whatsapp`) solo puede hablar de números de
 * esa empresa. Lo que se comprueba aquí es la atadura en el worker: aunque la
 * firma sea válida para la empresa A, un evento sobre un número de B se
 * descarta. Por el webhook de la plataforma no hay atadura: la empresa sale
 * del número.
 *
 *   npm run test:inbound --workspace=apps/api
 */
import test from "node:test";
import assert from "node:assert/strict";
import { InboundProcessor } from "../src/modules/whatsapp/processors/inbound.processor";

function procesador(orgDelNumero: string | null) {
  const llamadas: string[] = [];
  const messaging = {
    handleStatus: async () => {
      llamadas.push("status");
    },
  };
  const connection = {
    resolveChannel: async () =>
      orgDelNumero ? { id: "canal", orgId: orgDelNumero } : null,
    resolveOrgByWaba: async () => null,
  };
  const p = new InboundProcessor(
    messaging as never,
    connection as never,
    {} as never,
    {} as never,
  );
  return { p, llamadas };
}

const evento = (orgId?: string) => ({
  data: {
    kind: "status",
    channelPhoneNumberId: "111",
    waMessageId: "wamid.1",
    status: "delivered",
    ...(orgId ? { orgId } : {}),
  },
});

test("el evento sobre un número de otra empresa se descarta sin procesar", async () => {
  const { p, llamadas } = procesador("org_b");
  await p.process(evento("org_a") as never);
  assert.deepEqual(llamadas, []);
});

test("el evento sobre un número propio se procesa", async () => {
  const { p, llamadas } = procesador("org_a");
  await p.process(evento("org_a") as never);
  assert.deepEqual(llamadas, ["status"]);
});

test("por el webhook de la plataforma (sin orgId) la empresa sale del número", async () => {
  const { p, llamadas } = procesador("org_b");
  await p.process(evento() as never);
  assert.deepEqual(llamadas, ["status"]);
});
