// Comprueba que todo mensaje de error del código tenga traducción al inglés.
// Se ejecuta con: npm run check:i18n -w @crm/api
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ES_TO_EN } from "../src/i18n/messages";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

const found = new Set<string>();
function walk(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".ts") && !p.includes(`${path.sep}i18n${path.sep}`)) {
      const src = fs.readFileSync(p, "utf8");
      for (const m of src.matchAll(/Exception\(\s*"([^"]{4,})"/g)) found.add(m[1]);
    }
  }
}
walk(SRC);

const missing = [...found].filter((m) => !(m in ES_TO_EN));
if (missing.length === 0) {
  console.log(`i18n OK: ${found.size} mensajes, todos traducidos.`);
  process.exit(0);
}
console.error(
  `Faltan ${missing.length} traducción(es) en src/i18n/messages.ts:\n` +
    missing.map((m) => `  "${m}"`).join("\n"),
);
process.exit(1);
