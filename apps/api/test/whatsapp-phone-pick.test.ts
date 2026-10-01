import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPhoneNumber } from "../src/modules/whatsapp/whatsapp-connection.service";
import { techProviderApproval } from "../src/modules/whatsapp/connect-hub.controller";

/**
 * Coexistencia por Embedded Signup: Meta solo devuelve la WABA, y el número
 * se elige entre los que lista la Graph API. Sin Meta de por medio.
 */
test("una WABA con un solo número: ese", () => {
  const pick = pickPhoneNumber([{ id: "111", display_phone_number: "+51 1" }], "coexistence");
  assert.equal(pick?.id, "111");
});

test("varios números en coexistencia: el último que está en la app del celular", () => {
  const pick = pickPhoneNumber(
    [
      { id: "a", is_on_biz_app: false },
      { id: "b", is_on_biz_app: true },
      { id: "c", is_on_biz_app: true },
      { id: "d", is_on_biz_app: false },
    ],
    "coexistence",
  );
  assert.equal(pick?.id, "c");
});

test("varios números sin ninguno en la app (o modo API): el primero", () => {
  assert.equal(pickPhoneNumber([{ id: "a" }, { id: "b" }], "coexistence")?.id, "a");
  assert.equal(pickPhoneNumber([{ id: "a", is_on_biz_app: true }, { id: "b" }], "api")?.id, "a");
});

test("sin números: null", () => {
  assert.equal(pickPhoneNumber([], "coexistence"), null);
});

test("aprobación de Meta: solo cuenta en SaaS y acepta true/1/sí", () => {
  const prev = process.env.WHATSAPP_TECH_PROVIDER_APPROVED;
  try {
    delete process.env.WHATSAPP_TECH_PROVIDER_APPROVED;
    assert.equal(techProviderApproval(false), "approved", "una sola empresa: su app, sus roles");
    assert.equal(techProviderApproval(true), "pending", "SaaS sin la variable: pendiente");
    for (const v of ["true", "1", "sí", "SI", " yes "]) {
      process.env.WHATSAPP_TECH_PROVIDER_APPROVED = v;
      assert.equal(techProviderApproval(true), "approved", `valor ${v}`);
    }
    process.env.WHATSAPP_TECH_PROVIDER_APPROVED = "false";
    assert.equal(techProviderApproval(true), "pending");
  } finally {
    if (prev === undefined) delete process.env.WHATSAPP_TECH_PROVIDER_APPROVED;
    else process.env.WHATSAPP_TECH_PROVIDER_APPROVED = prev;
  }
});
