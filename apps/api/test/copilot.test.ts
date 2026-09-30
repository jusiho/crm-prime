/**
 * Copiloto y conocimiento: seguridad de las URLs que se importan, extracción
 * de texto de páginas, y lectura de lo que devuelve el modelo.
 *
 *   npm run test:copilot --workspace=apps/api
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPublicUrl,
  decodeEntities,
  htmlToText,
  isPrivateAddress,
  sameSiteLinks,
} from "../src/modules/knowledge/url-import";
import {
  cleanRewrite,
  parseGaps,
  parseMemory,
  parseSummary,
  questionKey,
  rewriteSystem,
} from "../src/modules/ai/copilot.prompts";
import { memoryText } from "../src/modules/ai/agent.service";

test("las direcciones internas se rechazan (SSRF)", () => {
  for (const ip of ["127.0.0.1", "10.0.0.5", "172.20.0.3", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "104.16.1.1", "2606:4700::1111"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("assertPublicUrl bloquea esquemas, puertos y hosts internos sin tocar la red", async () => {
  await assert.rejects(() => assertPublicUrl("file:///etc/passwd"), /http o https/);
  await assert.rejects(() => assertPublicUrl("http://localhost/api"), /no es pública/);
  await assert.rejects(() => assertPublicUrl("http://127.0.0.1/"), /no es pública/);
  await assert.rejects(() => assertPublicUrl("http://[::1]/"), /no es pública/);
  await assert.rejects(() => assertPublicUrl("http://169.254.169.254/latest/meta-data"), /no es pública/);
  await assert.rejects(() => assertPublicUrl("https://ejemplo.com:5432/"), /puertos/);
  await assert.rejects(() => assertPublicUrl("https://user:pass@ejemplo.com/"), /usuario/);
  await assert.rejects(() => assertPublicUrl("http://crm-db.internal/"), /no es pública/);
});

test("htmlToText se queda con el contenido y quita menús y scripts", () => {
  const html = `<html><head><title>Envíos &amp; devoluciones</title><style>.x{}</style></head>
    <body><nav>Inicio Tienda</nav><main><h1>Envíos</h1><p>Enviamos a todo el Perú en 48&nbsp;h.</p>
    <ul><li>Lima: gratis</li><li>Provincias: S/ 15</li></ul><script>alert(1)</script></main>
    <footer>© 2026</footer></body></html>`;
  const { title, text } = htmlToText(html);
  assert.equal(title, "Envíos & devoluciones");
  assert.match(text, /Enviamos a todo el Perú en 48 h\./);
  assert.match(text, /- Lima: gratis/);
  assert.doesNotMatch(text, /alert|Inicio Tienda|© 2026|\.x\{\}/);
  assert.equal(decodeEntities("&iquest;Precio&#63; &#x41;"), "¿Precio? A");
});

test("sameSiteLinks solo sigue páginas del mismo sitio", () => {
  const html = `<a href="/precios">P</a><a href="https://otro.com/x">O</a><a href="/manual.pdf">M</a><a href="#top">T</a><a href="faq?x=1#a">F</a>`;
  assert.deepEqual(sameSiteLinks(html, "https://tienda.com/inicio"), [
    "https://tienda.com/precios",
    "https://tienda.com/faq?x=1",
  ]);
});

test("reescritura: prompt por modo y limpieza de la salida", () => {
  assert.match(rewriteSystem("grammar", null, ""), /ortografía/);
  assert.match(rewriteSystem("translate", "inglés", ""), /al inglés/);
  assert.match(rewriteSystem("translate", "customer", "Hi, how much is it?"), /Hi, how much is it\?/);
  assert.equal(cleanRewrite('"Hola, ¿cómo estás?"'), "Hola, ¿cómo estás?");
  assert.equal(cleanRewrite("Mensaje: Listo, te lo envío hoy."), "Listo, te lo envío hoy.");
});

test("resumen, memoria y huecos se leen aunque el modelo envuelva el JSON", () => {
  const s = parseSummary('```json\n{"summary":"Quiere 3 camisetas","points":["Talla M","Paga con Yape"],"nextStep":"Enviar link de pago","mood":"positive"}\n```');
  assert.equal(s.summary, "Quiere 3 camisetas");
  assert.deepEqual(s.points, ["Talla M", "Paga con Yape"]);
  assert.equal(s.mood, "positive");
  assert.equal(parseSummary("texto suelto").summary, "texto suelto");

  const m = parseMemory('{"summary":"Cliente de Arequipa","facts":["Prefiere envío a domicilio", 3, ""]}');
  assert.deepEqual(m, { summary: "Cliente de Arequipa", facts: ["Prefiere envío a domicilio"] });
  assert.equal(memoryText(m), "Cliente de Arequipa\n- Prefiere envío a domicilio");
  assert.equal(memoryText(null), "");

  const g = parseGaps('{"gaps":[{"question":"¿Hacen envíos a provincia?","answer":"Sí, 48h","conversations":["C1","C4"]},{"question":"ok"}]}');
  assert.equal(g.length, 1);
  assert.deepEqual(g[0]!.refs, ["C1", "C4"]);
  assert.equal(questionKey("¿Hacen ENVÍOS a provincia?"), questionKey("hacen envios a provincia"));
});
