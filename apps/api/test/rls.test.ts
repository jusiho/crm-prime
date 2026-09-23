/**
 * Row-Level Security: la capa 2.
 *
 * La capa 1 (extensión que inyecta el `where`) ya se prueba en tenancy.test.ts.
 * Aquí se comprueba lo que la capa 1 **no puede** cubrir: SQL crudo. Si estos
 * tests pasan, una consulta escrita a mano sin filtro de empresa devuelve los
 * datos de quien pregunta y nada más.
 *
 *   npm run test:rls --workspace=apps/api
 *
 * Requiere una base con las políticas aplicadas y el rol restringido creado
 * (scripts/create-app-role.sql). El script `pretest:rls` lo deja listo.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";

const DB =
  process.env.RLS_DATABASE_URL ??
  "postgresql://crm_app:clave-de-prueba@localhost:5433/crm_rls_test";

process.env.TENANCY_MODE = "multi";
process.env.DB_RLS = "on";
process.env.DATABASE_URL = DB;

let prisma: any;
let base: any;
let ctx: typeof import("../src/infra/tenant/tenant.context");

before(async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { tenantScopeExtension } = await import("../src/infra/tenant/tenant-scope");
  const { createRlsExtension, withAtomicTransactions } = await import("../src/infra/tenant/rls");
  ctx = await import("../src/infra/tenant/tenant.context");

  base = new PrismaClient({ datasources: { db: { url: DB } } });
  const ext = base.$extends(tenantScopeExtension).$extends(createRlsExtension(base));
  prisma = withAtomicTransactions(ext, base);
});

after(async () => {
  await base?.$disconnect();
});

test("el rol de la aplicación no es dueño de las tablas ni se salta RLS", async () => {
  const [rol] = await ctx.runUnscoped("test", () =>
    base.$queryRawUnsafe(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    ),
  );
  assert.equal(rol.rolsuper, false, "el rol es superusuario: RLS no protege nada");
  assert.equal(rol.rolbypassrls, false, "el rol tiene BYPASSRLS");

  const [dueño] = await ctx.runUnscoped("test", () =>
    base.$queryRawUnsafe(
      `SELECT tableowner = current_user AS es_dueño FROM pg_tables WHERE tablename = 'contacts'`,
    ),
  );
  assert.equal(dueño.es_dueño, false, "la app es dueña de las tablas: las políticas no se aplican");
});

test("SQL crudo sin filtro de empresa solo devuelve lo propio", async () => {
  await ctx.runInOrg("o_a", async () => {
    // Deliberadamente sin WHERE: esto es lo que la capa 1 NO puede acotar.
    const filas: any[] = await prisma.$queryRawUnsafe(`SELECT id, "orgId" FROM contacts`);
    assert.equal(filas.length, 1);
    assert.equal(filas[0].orgId, "o_a");
  });
});

test("la búsqueda del RAG no alcanza los documentos de otra empresa", async () => {
  // Es la consulta real del servicio de conocimiento: un JOIN sin filtro.
  const sql = `SELECT kc.content FROM knowledge_chunks kc
               JOIN knowledge_docs kd ON kd.id = kc."docId"`;
  await ctx.runInOrg("o_a", async () => {
    const filas: any[] = await prisma.$queryRawUnsafe(sql);
    assert.deepEqual(filas.map((r) => r.content), ["secreto de Acme"]);
  });
  await ctx.runInOrg("o_b", async () => {
    const filas: any[] = await prisma.$queryRawUnsafe(sql);
    assert.deepEqual(filas.map((r) => r.content), ["secreto de Globex"]);
  });
});

test("sin organización en contexto, el SQL crudo devuelve vacío (falla cerrado)", async () => {
  const filas: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM contacts`);
  assert.equal(filas.length, 0, "debería no ver nada, no verlo todo");
});

test("no se puede escribir una fila en otra empresa", async () => {
  await ctx.runInOrg("o_a", async () => {
    await assert.rejects(
      () =>
        prisma.$executeRawUnsafe(
          `INSERT INTO contacts (id,"orgId",phone,"updatedAt") VALUES ('x1','o_b','+51911111111',now())`,
        ),
      /row-level security|violates/i,
    );
  });
});

test("las transacciones por lotes de la aplicación siguen funcionando", async () => {
  await ctx.runInOrg("o_a", async () => {
    // Es la forma que usa pipeline.service para reordenar etapas.
    const r = await prisma.$transaction([
      prisma.pipelineStage.update({ where: { id: "s1" }, data: { order: 10 } }),
      prisma.pipelineStage.update({ where: { id: "s2" }, data: { order: 11 } }),
    ]);
    assert.equal(r.length, 2);
    assert.equal(r[0].order, 10);
    assert.equal(r[1].order, 11);
  });
});

test("runUnscoped atraviesa RLS, que es para lo que existe", async () => {
  await ctx.runUnscoped("test", async () => {
    const filas: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM contacts`);
    assert.equal(filas.length, 2);
  });
});

test("un lote que falla a la mitad no deja la primera operación aplicada", async () => {
  await ctx.runInOrg("o_a", async () => {
    const antes = await prisma.pipelineStage.findUnique({ where: { id: "s1" } });
    await assert.rejects(() =>
      prisma.$transaction([
        prisma.pipelineStage.update({ where: { id: "s1" }, data: { order: 777 } }),
        prisma.pipelineStage.update({ where: { id: "no-existe" }, data: { order: 1 } }),
      ]),
    );
    const despues = await prisma.pipelineStage.findUnique({ where: { id: "s1" } });
    assert.equal(
      despues.order,
      antes.order,
      "envolver cada operación en su propia transacción rompería la atomicidad",
    );
  });
});

test("el atajo runUnscoped(() => consulta) aplica de verdad la escapatoria", async () => {
  // Las promesas de Prisma son perezosas: si `runUnscoped` no espera dentro del
  // contexto, la consulta se ejecuta ya fuera y la escapatoria no aplica. Con
  // RLS activo eso dejaría a todo el mundo sin poder iniciar sesión, porque el
  // login busca al usuario por correo antes de saber de qué empresa es.
  const filas: any[] = await ctx.runUnscoped("test", () =>
    prisma.$queryRawUnsafe(`SELECT id FROM contacts`),
  );
  assert.equal(filas.length, 2, "la escapatoria no se aplicó a la consulta");
});

test("el atajo runInOrg(() => consulta) acota de verdad", async () => {
  const filas: any[] = await ctx.runInOrg("o_b", () =>
    prisma.$queryRawUnsafe(`SELECT id, "orgId" FROM contacts`),
  );
  assert.equal(filas.length, 1);
  assert.equal(filas[0].orgId, "o_b");
});
