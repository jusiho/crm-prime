/**
 * Planes del SaaS: límites al añadir, características por plan, y que en una
 * instalación propia no hay límites. Base de datos simulada.
 *
 *   npm run test:plans --workspace=apps/api
 */
import test, { before } from "node:test";
import assert from "node:assert/strict";

// El modo se lee al importar el contexto, así que se fija antes y los módulos
// se cargan después (los `import` estáticos se adelantarían a esta línea).
process.env.TENANCY_MODE = "multi";

let shared: typeof import("@crm/shared");
let PlansService: typeof import("../src/modules/plans/plans.service").PlansService;

before(async () => {
  shared = await import("@crm/shared");
  ({ PlansService } = await import("../src/modules/plans/plans.service"));
});

function service(state: { plan: string | null; numbers: number; users: number }) {
  const prisma = {
    organization: { findUnique: async () => (state.plan === null ? null : { plan: state.plan }) },
    whatsappConnection: { count: async () => state.numbers },
    user: { count: async () => state.users },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PlansService(prisma as any, { orgId: () => "org_1" } as any);
}

test("el catálogo es coherente: cada plan superior incluye lo del anterior", () => {
  const { PLANS, planFor, planWithFeature, formatPlanPrice } = shared;
  assert.equal(PLANS.free.limits.numbers, 1);
  assert.equal(PLANS.pro.features.coexistence, true);
  assert.equal(PLANS.business.limits.numbers, null, "Empresa no tiene tope de números");
  assert.equal(planWithFeature("coexistence")?.key, "pro");
  assert.equal(planWithFeature("prioritySupport")?.key, "business");
  assert.equal(planFor("desconocido").key, "free", "un plan raro cae en Gratis");
  assert.equal(planFor(null).key, "free");
  assert.equal(formatPlanPrice(PLANS.free), "Sin costo");
  assert.equal(formatPlanPrice(PLANS.pro), "USD 49/mes");
});

test("Gratis: un número, dos usuarios, sin coexistencia", async () => {
  const svc = service({ plan: "free", numbers: 1, users: 2 });
  await assert.rejects(() => svc.assertCanAdd("numbers"), /admite 1 número de WhatsApp/);
  await assert.rejects(() => svc.assertCanAdd("users"), /admite 2 usuarios/);
  await assert.rejects(() => svc.assertFeature("coexistence"), /a partir del plan Pro/);
  await assert.rejects(() => svc.assertFeature("broadcasts"), /Difusiones/);
});

test("por debajo del límite se puede añadir", async () => {
  const svc = service({ plan: "free", numbers: 0, users: 1 });
  await assert.doesNotReject(() => svc.assertCanAdd("numbers"));
  await assert.doesNotReject(() => svc.assertCanAdd("users"));
});

test("Pro incluye coexistencia y difusiones; Empresa no tiene topes", async () => {
  const pro = service({ plan: "pro", numbers: 3, users: 10 });
  await assert.doesNotReject(() => pro.assertFeature("coexistence"));
  await assert.doesNotReject(() => pro.assertFeature("broadcasts"));
  await assert.rejects(() => pro.assertCanAdd("numbers"), /admite 3 números/);
  await assert.rejects(() => pro.assertFeature("prioritySupport"), /Empresa/);

  const business = service({ plan: "business", numbers: 40, users: 200 });
  await assert.doesNotReject(() => business.assertCanAdd("numbers"));
  await assert.doesNotReject(() => business.assertCanAdd("users"));
});

test("mine() devuelve el plan, el uso y el catálogo", async () => {
  const svc = service({ plan: "pro", numbers: 2, users: 4 });
  const mine = await svc.mine();
  assert.equal(mine.saas, true);
  assert.equal(mine.plan.key, "pro");
  assert.deepEqual(mine.usage, { numbers: 2, users: 4 });
  assert.deepEqual(
    mine.plans.map((p) => p.key),
    ["free", "pro", "business"],
  );
});
