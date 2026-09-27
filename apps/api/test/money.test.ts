/**
 * Precios multimoneda: país por prefijo, moneda del contacto y precio a usar.
 *
 *   npm run test:money --workspace=apps/api
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  contactCurrency,
  countryFromPhone,
  priceColumnCurrency,
  priceFor,
  toProductImportRow,
  guessColumnMapping,
} from "@crm/shared";

test("el país sale del prefijo más largo", () => {
  assert.equal(countryFromPhone("+5215512345678")?.code, "MX");
  assert.equal(countryFromPhone("+51987654321")?.currency, "PEN");
  assert.equal(countryFromPhone("+18095551234")?.code, "DO");
  assert.equal(countryFromPhone("+12125551234")?.code, "US");
  assert.equal(countryFromPhone("+593991234567")?.currency, "USD");
  assert.equal(countryFromPhone("+999123"), null);
});

test("la moneda fijada en la ficha gana a la del país", () => {
  assert.equal(contactCurrency({ phone: "+5215512345678" }), "MXN");
  assert.equal(contactCurrency({ phone: "+5215512345678", currency: "USD" }), "USD");
  assert.equal(contactCurrency({ phone: "+999123" }), null);
});

test("precio en la moneda del cliente, o el base marcado como respaldo", () => {
  const p = { price: 49, currency: "USD", prices: [{ currency: "MXN", amount: 899 }] };
  assert.deepEqual(priceFor(p, "MXN"), { amount: 899, currency: "MXN", fallback: false });
  assert.deepEqual(priceFor(p, "USD"), { amount: 49, currency: "USD", fallback: false });
  assert.deepEqual(priceFor(p, "PEN"), { amount: 49, currency: "USD", fallback: true });
  assert.deepEqual(priceFor(p, null), { amount: 49, currency: "USD", fallback: false });
});

test("la importación lee columnas precio_XXX", () => {
  assert.equal(priceColumnCurrency("precio_MXN"), "MXN");
  assert.equal(priceColumnCurrency("Precio (EUR)"), "EUR");
  assert.equal(priceColumnCurrency("precio"), null);
  const headers = ["nombre", "precio", "moneda", "precio_MXN", "precio_PEN"];
  const row = toProductImportRow(
    { nombre: "Plan Pro", precio: "49", moneda: "USD", precio_MXN: "899", precio_PEN: "" },
    guessColumnMapping(headers),
  );
  assert.ok(row.ok);
  if (row.ok) assert.deepEqual(row.value.prices, [{ currency: "MXN", amount: 899 }]);
});
