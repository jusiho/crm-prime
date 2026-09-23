/**
 * Reglas del subdominio.
 *
 * Un slug mal validado no se nota hasta que ya hay un cliente usándolo, y
 * entonces quitárselo es un correo incómodo. Por eso se comprueba aquí y no
 * "cuando pase".
 *
 *   npm run test:slug --workspace=apps/api
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  orgSlugSchema,
  suggestSlug,
  RESERVED_SUBDOMAINS,
  extraReserved,
} from "@crm/shared";

const vale = (s: string) => orgSlugSchema.safeParse(s).success;

test("acepta lo que es una etiqueta DNS válida", () => {
  for (const s of ["acme", "globex-peru", "a1b2", "empresa123", "x".repeat(63)]) {
    assert.ok(vale(s), `debería aceptar "${s.slice(0, 20)}"`);
  }
});

test("rechaza lo que rompería el DNS", () => {
  const malos: [string, string][] = [
    ["ab", "menos de 3 caracteres"],
    ["x".repeat(64), "pasa de 63, el límite de una etiqueta DNS"],
    ["-acme", "empieza por guión"],
    ["acme-", "acaba en guión"],
    ["ac--me", "dos guiones seguidos"],
    ["Acme S.A.", "espacios y puntos"],
    ["acme.globex", "un punto crea otro nivel que el comodín no cubre"],
    ["acmé", "tilde"],
    ["acme_1", "guión bajo no es válido en DNS"],
  ];
  for (const [s, porque] of malos) {
    assert.equal(vale(s), false, `debería rechazar "${s}" (${porque})`);
  }
});

test("rechaza los subdominios reservados", () => {
  // "crm" entra aquí por una razón concreta: si el producto se sirve en
  // crm.tudominio.com, un cliente que registre esa empresa se queda con tu URL.
  for (const s of ["www", "api", "admin", "mail", "cdn", "status", "crm", "inbox", "chat"]) {
    assert.equal(vale(s), false, `"${s}" debería estar reservado`);
    assert.ok(RESERVED_SUBDOMAINS.has(s));
  }
});

test("normaliza a minúsculas en vez de rechazar", () => {
  // Escribir "ACME" es un error de teclado, no una intención distinta.
  const r = orgSlugSchema.safeParse("ACME");
  assert.ok(r.success);
  assert.equal(r.data, "acme");
});

test("la sugerencia a partir del nombre siempre sale válida", () => {
  const casos = [
    ["Acme S.A.", "acme-s-a"],
    ["Café Perú", "cafe-peru"],
    ["  Globex   Corp  ", "globex-corp"],
    ["Ñandú & Cía.", "nandu-cia"],
  ];
  for (const [entrada, esperado] of casos) {
    const s = suggestSlug(entrada!);
    assert.equal(s, esperado, `suggestSlug("${entrada}")`);
    assert.ok(vale(s), `la sugerencia "${s}" debería ser válida`);
  }
});

test("los reservados del despliegue se leen de la variable de entorno", () => {
  // Cada instalación protege los subdominios que ya está usando, sin tocar
  // código: RESERVED_SUBDOMAINS_EXTRA="crm,soporte,blog".
  const extra = extraReserved(" crm , Soporte ,, blog ");
  assert.deepEqual([...extra].sort(), ["blog", "crm", "soporte"]);
  assert.deepEqual([...extraReserved(undefined)], []);
});
