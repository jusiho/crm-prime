#!/usr/bin/env node
/**
 * Instalación en un comando: `npm run setup`.
 *
 * Hace en orden lo que antes eran ocho pasos manuales, y resuelve las tres
 * cosas que se rompían en silencio:
 *   - el .env con secretos de verdad (no los de ejemplo del repo),
 *   - la espera a que Postgres acepte conexiones (docker compose vuelve antes),
 *   - la extensión pgvector y su índice, que nadie creaba.
 *
 * Es idempotente: puedes relanzarlo cuando quieras. No pisa un .env existente
 * ni vuelve a sembrar si ya hay datos.
 */
import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOTAL = 6;
let step = 0;

const c = {
  dim: (t) => `\x1b[2m${t}\x1b[0m`,
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  bold: (t) => `\x1b[1m${t}\x1b[0m`,
};

function heading(text) {
  step += 1;
  process.stdout.write(`\n${c.bold(`[${step}/${TOTAL}]`)} ${text}\n`);
}
const ok = (t) => console.log(`      ${c.green("✓")} ${t}`);
const info = (t) => console.log(`      ${c.dim(t)}`);
const warn = (t) => console.log(`      ${c.yellow("!")} ${t}`);

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, stdio: "pipe", encoding: "utf8", ...opts });
}

/** Junta ambos flujos: un fallo puede escribir en stdout, en stderr o en los dos. */
function output(e) {
  return `${e?.stdout ?? ""}
${e?.stderr ?? ""}`.trim();
}

function fail(message, detail) {
  console.error(`\n${c.red("✗")} ${message}`);
  if (detail) console.error(c.dim(String(detail).trim().slice(0, 600)));
  process.exit(1);
}

// ── 1. .env ───────────────────────────────────────────────────
function setupEnv() {
  heading("Configuración (.env)");
  const envPath = join(root, ".env");

  if (existsSync(envPath)) {
    ok(".env ya existe, no se toca");
    return;
  }

  const examplePath = join(root, ".env.example");
  if (!existsSync(examplePath)) fail("Falta .env.example en la raíz del repo.");

  let content = readFileSync(examplePath, "utf8");

  // Los valores de ejemplo están publicados en el repo: aquí se sustituyen
  // por secretos reales para que nadie arranque con uno conocido.
  for (const key of ["JWT_ACCESS_SECRET", "AUTH_SECRET", "APP_ENCRYPTION_KEY"]) {
    const secret = randomBytes(32).toString("base64url");
    const re = new RegExp(`^#?[ \\t]*${key}=.*$`, "m");
    if (re.test(content)) content = content.replace(re, `${key}="${secret}"`);
    else content += `\n${key}="${secret}"\n`;
  }

  writeFileSync(envPath, content);
  ok(".env creado con secretos generados");
  info("Las claves de IA y WhatsApp se configuran después desde Ajustes.");
}

// ── 2. Docker ─────────────────────────────────────────────────
function startDocker() {
  heading("Base de datos y Redis");
  try {
    run("docker compose up -d");
  } catch (e) {
    fail(
      "No se pudo levantar Docker. ¿Está Docker Desktop en marcha?",
      output(e),
    );
  }
  ok("Contenedores arriba");

  // `docker compose up -d` vuelve enseguida, pero Postgres tarda en aceptar
  // conexiones. Sin esta espera, la migración falla en un clon nuevo.
  process.stdout.write(`      ${c.dim("Esperando a Postgres")}`);
  for (let i = 0; i < 60; i++) {
    const r = spawnSync(
      "docker",
      ["compose", "exec", "-T", "db", "pg_isready", "-U", "crm", "-d", "crm"],
      { cwd: root, stdio: "pipe" },
    );
    if (r.status === 0) {
      process.stdout.write(` ${c.green("listo")}\n`);
      return;
    }
    process.stdout.write(".");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  process.stdout.write("\n");
  fail("Postgres no respondió en 60 s. Revisa `docker compose logs db`.");
}

// ── 3. Paquete compartido ─────────────────────────────────────
function buildShared() {
  heading("Compilando @crm/shared");
  try {
    run("npm run build -w @crm/shared");
  } catch (e) {
    fail("Falló la compilación del paquete compartido.", output(e));
  }
  ok("Tipos y esquemas listos (los consumen api y web)");
}

// ── 4. Esquema de base de datos ───────────────────────────────
function migrate() {
  heading("Esquema de base de datos");
  const schema = "apps/api/prisma/schema.prisma";
  try {
    run(`npx prisma generate --schema ${schema}`);
    ok("Cliente Prisma generado");
  } catch (e) {
    const out = output(e);
    if (out.includes("EPERM") || out.includes("operation not permitted")) {
      fail(
        "Prisma no pudo escribir el cliente: hay un proceso Node usándolo.\n" +
          "  Cierra los servidores de desarrollo y vuelve a lanzar `npm run setup`.",
      );
    }
    fail("Falló `prisma generate`.", out);
  }

  try {
    run(`npx prisma migrate deploy --schema ${schema}`);
    ok("Migraciones aplicadas");
  } catch (e) {
    fail("Falló la migración.", output(e));
  }
}

// ── 5. pgvector ───────────────────────────────────────────────
function enableVector() {
  heading("Extensión pgvector (búsqueda semántica)");
  const sql = [
    "CREATE EXTENSION IF NOT EXISTS vector;",
    "CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx " +
      "ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);",
  ].join(" ");

  const r = spawnSync(
    "docker",
    ["compose", "exec", "-T", "db", "psql", "-U", "crm", "-d", "crm", "-c", sql],
    { cwd: root, stdio: "pipe", encoding: "utf8" },
  );
  if (r.status !== 0) {
    // No bloquea: todo el CRM funciona sin RAG. Mejor avisar que abortar.
    warn("No se pudo habilitar pgvector; la base de conocimiento no buscará bien.");
    info(String(r.stderr || "").trim().split("\n")[0] ?? "");
    return;
  }
  ok("Extensión e índice vectorial listos");
}

// ── 6. Datos iniciales ────────────────────────────────────────
function seed() {
  heading("Datos iniciales");
  try {
    const out = run("npm run db:seed -w @crm/api");
    ok("Admin, etapas del pipeline y agente por defecto");
    if (out.includes("ya exist")) info("Ya había datos: no se duplicó nada.");
  } catch (e) {
    fail("Falló el sembrado.", output(e));
  }
}

// ── Main ──────────────────────────────────────────────────────
console.log(c.bold("\nCRM Prime · instalación"));

setupEnv();
startDocker();
buildShared();
migrate();
enableVector();
seed();

console.log(`
${c.green(c.bold("Listo."))}

  Arranca con    ${c.bold("npm run dev")}
  Web            http://localhost:3000
  API            http://localhost:3001/api/v1
  Acceso         admin@crm.local / admin1234

  ${c.dim("Las claves de IA y WhatsApp se configuran desde Ajustes, sin tocar el .env.")}
`);
