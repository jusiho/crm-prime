#!/usr/bin/env node
/**
 * Crea la base de un test si no existe.
 *
 * Los tests no deben depender de que alguien haya creado la base a mano: si
 * falta, el fallo que sale es "migrate deploy failed", que no dice nada sobre
 * la causa real y hace perder un rato.
 *
 *   node scripts/ensure-test-db.mjs crm_tenancy_test
 */
import { execFileSync } from "node:child_process";

const db = process.argv[2];
if (!db) {
  console.error("Falta el nombre de la base");
  process.exit(1);
}
const contenedor = process.env.PG_CONTAINER ?? "crm-db";
const usuario = process.env.PG_USER ?? "crm";

try {
  const existe = execFileSync(
    "docker",
    ["exec", contenedor, "psql", "-U", usuario, "-d", "postgres", "-tAc",
     `SELECT 1 FROM pg_database WHERE datname = '${db}'`],
    { encoding: "utf8" },
  ).trim();

  if (existe !== "1") {
    execFileSync("docker", ["exec", contenedor, "psql", "-U", usuario, "-d", "postgres",
      "-c", `CREATE DATABASE ${db}`], { stdio: "ignore" });
    console.log(`· Base ${db} creada`);
  }
} catch (e) {
  console.error(
    `No se pudo preparar ${db}. ¿Está levantado el contenedor "${contenedor}"?\n` +
      `  docker compose up -d db`,
  );
  process.exit(1);
}
