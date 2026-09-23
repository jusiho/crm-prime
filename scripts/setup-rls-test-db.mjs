#!/usr/bin/env node
/**
 * Deja lista la base contra la que corre test/rls.test.ts.
 *
 * RLS no se puede probar contra la base de desarrollo: hace falta una donde la
 * aplicación NO sea dueña de las tablas, porque el dueño se salta las
 * políticas. Este script crea esa base, aplica las migraciones como dueño y
 * crea el rol restringido.
 */
import { execFileSync } from "node:child_process";

const DB = process.env.RLS_TEST_DB ?? "crm_rls_test";
const PASS = process.env.RLS_TEST_PASSWORD ?? "clave-de-prueba";
const CONTAINER = process.env.PG_CONTAINER ?? "crm-db";
const OWNER_URL = `postgresql://crm:crm@localhost:5433/${DB}`;

const psql = (args, input) =>
  execFileSync("docker", ["exec", ...(input ? ["-i"] : []), CONTAINER, "psql", ...args], {
    input,
    stdio: input ? ["pipe", "ignore", "inherit"] : ["ignore", "ignore", "inherit"],
  });

console.log(`· Recreando ${DB}`);
psql(["-U", "crm", "-d", "postgres", "-c", `DROP DATABASE IF EXISTS ${DB}`]);
psql(["-U", "crm", "-d", "postgres", "-c", `CREATE DATABASE ${DB}`]);

console.log("· Aplicando migraciones (como dueño)");
execFileSync("npx", ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
  env: { ...process.env, DATABASE_URL: OWNER_URL },
  stdio: ["ignore", "ignore", "inherit"],
  shell: process.platform === "win32",
});

console.log("· Creando el rol restringido crm_app");
psql(["-U", "crm", "-d", DB, "-q", "-v", `pass=${PASS}`, "-f", "-"],
  await import("node:fs").then((fs) => fs.readFileSync("../../scripts/create-app-role.sql", "utf8")));

console.log("· Sembrando dos empresas");
psql(["-U", "crm", "-d", DB, "-q", "-c", `
  INSERT INTO organizations (id,slug,name,"updatedAt") VALUES
    ('o_a','acme','Acme',now()),('o_b','globex','Globex',now());
  INSERT INTO contacts (id,"orgId",phone,name,"updatedAt") VALUES
    ('c1','o_a','+51900000001','Acme',now()),('c2','o_b','+51900000002','Globex',now());
  INSERT INTO knowledge_docs (id,"orgId",title,content,"updatedAt") VALUES
    ('k1','o_a','Doc Acme','x',now()),('k2','o_b','Doc Globex','y',now());
  INSERT INTO knowledge_chunks (id,"docId",content) VALUES
    ('kc1','k1','secreto de Acme'),('kc2','k2','secreto de Globex');
  INSERT INTO pipeline_stages (id,"orgId",name,"order") VALUES
    ('s1','o_a','Nuevo',0),('s2','o_a','Ganado',1),('s3','o_b','Nuevo',0);
`]);

console.log(`✔ ${DB} lista. Ahora: npm run test:rls --workspace=apps/api`);
