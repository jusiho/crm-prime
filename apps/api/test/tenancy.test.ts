/**
 * Aislamiento entre empresas.
 *
 * Es el test que justifica toda la fase 2: con dos organizaciones sembradas,
 * ninguna consulta puede alcanzar los datos de la otra. Las comprobaciones que
 * importan son las **negativas** — que algo NO se vea, que un borrado NO
 * alcance —, porque un fallo de aislamiento no rompe nada, solo filtra.
 *
 *   npm run test:tenancy --workspace=apps/api
 *
 * Usa su propia base (TEST_DATABASE_URL) y la deja lista con las migraciones.
 * No toca la base de desarrollo.
 */
import { execSync } from "node:child_process";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";

const DB =
  process.env.TEST_DATABASE_URL ??
  "postgresql://crm:crm@localhost:5433/crm_tenancy_test";

// El modo se lee al importar el módulo de contexto, así que se fija antes.
process.env.TENANCY_MODE = "multi";
process.env.DATABASE_URL = DB;

type Ctx = typeof import("../src/infra/tenant/tenant.context");
type Org = { id: string };

let prisma: any;
let plain: any;
let ctx: Ctx;
let acme: Org;
let globex: Org;
let contactoGlobex: { id: string };

before(async () => {
  execSync(`npx prisma migrate deploy --schema prisma/schema.prisma`, {
    env: { ...process.env, DATABASE_URL: DB },
    stdio: "ignore",
  });

  const { PrismaClient } = await import("@prisma/client");
  const { tenantScopeExtension } = await import("../src/infra/tenant/tenant-scope");
  ctx = await import("../src/infra/tenant/tenant.context");

  plain = new PrismaClient();
  prisma = new PrismaClient().$extends(tenantScopeExtension);

  await plain.$executeRawUnsafe('TRUNCATE "organizations" CASCADE');
  acme = await plain.organization.create({ data: { slug: "acme", name: "Acme" } });
  globex = await plain.organization.create({ data: { slug: "globex", name: "Globex" } });

  await plain.contact.create({
    data: { orgId: acme.id, phone: "+51900000001", name: "Cliente de Acme" },
  });
  await plain.contact.create({
    data: { orgId: globex.id, phone: "+51900000002", name: "Cliente de Globex" },
  });
  // El MISMO teléfono en las dos empresas. Tiene que poder existir: un cliente
  // puede escribirle a dos negocios distintos.
  await plain.contact.create({
    data: { orgId: acme.id, phone: "+51999999999", name: "Compartido/Acme" },
  });
  contactoGlobex = await plain.contact.create({
    data: { orgId: globex.id, phone: "+51999999999", name: "Compartido/Globex" },
  });
});

after(async () => {
  await plain?.$disconnect();
  await prisma?.$disconnect();
});

test("un listado solo devuelve la empresa en contexto", async () => {
  await ctx.runInOrg(acme.id, async () => {
    const filas = await prisma.contact.findMany();
    assert.equal(filas.length, 2);
    assert.ok(filas.every((c: { orgId: string }) => c.orgId === acme.id));
  });
});

test("buscar por un dato de otra empresa no la encuentra", async () => {
  await ctx.runInOrg(acme.id, async () => {
    const ajeno = await prisma.contact.findFirst({
      where: { phone: "+51900000002" },
    });
    assert.equal(ajeno, null);
  });
});

test("adivinar el id de otra empresa devuelve null, no la fila", async () => {
  await ctx.runInOrg(acme.id, async () => {
    const ajeno = await prisma.contact.findUnique({
      where: { id: contactoGlobex.id },
    });
    assert.equal(ajeno, null);
  });
});

test("count no cuenta lo ajeno", async () => {
  await ctx.runInOrg(acme.id, async () => {
    assert.equal(await prisma.contact.count(), 2);
  });
});

test("un borrado masivo no alcanza a la otra empresa", async () => {
  await ctx.runInOrg(acme.id, async () => {
    const r = await prisma.contact.deleteMany({
      where: { phone: "+51999999999" },
    });
    assert.equal(r.count, 1, "debía borrar solo el contacto de Acme");
  });
  await ctx.runInOrg(globex.id, async () => {
    const sigue = await prisma.contact.findUnique({
      where: { id: contactoGlobex.id },
    });
    assert.ok(sigue, "Globex perdió su contacto");
    assert.equal(sigue.name, "Compartido/Globex");
  });
});

test("actualizar por id ajeno falla", async () => {
  await ctx.runInOrg(acme.id, async () => {
    await assert.rejects(() =>
      prisma.contact.update({
        where: { id: contactoGlobex.id },
        data: { name: "secuestrado" },
      }),
    );
  });
});

test("sin organización en contexto, en modo SaaS la consulta rompe", async () => {
  await assert.rejects(
    () => prisma.contact.findMany(),
    /sin organización/i,
    "una consulta sin contexto debería fallar, no devolver todo",
  );
});

test("runUnscoped sigue viendo todo (es la escapatoria, y es explícita)", async () => {
  await ctx.runUnscoped("test", async () => {
    const filas = await prisma.contact.findMany();
    assert.equal(filas.length, 3);
  });
});
