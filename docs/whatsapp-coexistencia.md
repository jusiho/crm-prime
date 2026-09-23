# WhatsApp Coexistencia · Pendiente

Estado al **2026-09-15**. Objetivo: conectar el número con **coexistencia**
(seguir usando WhatsApp Business en el celular y, a la vez, gestionarlo desde
el CRM en `https://crm.flyteek.com`).

---

## Dónde se quedó

Al pulsar **Conectar WhatsApp**, la ventana de Meta muestra
*"Agrega tu número de teléfono de WhatsApp · Ingresar un nuevo número de
teléfono"*. Esa es la pantalla del flujo **normal** de la API, no la de
coexistencia.

> ⚠️ **No completes esa pantalla.** Registrar el número por ahí lo migra a la
> Cloud API y deja de funcionar en la app WhatsApp Business del celular.

---

## Bloqueo 1 · Requisito de Meta (resolver primero)

La opción *"conectar tu app de WhatsApp Business existente"* **solo aparece si
el negocio dueño de la app de Meta es Tech Provider o Solution Partner**.
Si no, Meta muestra la pantalla normal.

- [ ] Verificar el negocio: Meta Business Suite → Configuración → Centro de
      seguridad → Verificación del negocio.
- [ ] Convertirse en **Tech Provider** desde el panel de la app en
      developers.facebook.com (incluye App Review con acceso avanzado a
      `whatsapp_business_management` y `whatsapp_business_messaging`).
- [ ] Número en **WhatsApp Business app 2.24.17 o superior**.
- [ ] Confirmar que el país del número admite coexistencia.

---

## Bloqueo 2 · Bug en el CRM (arreglar antes de conectar)

Al terminar el flujo de coexistencia, Meta envía este evento. **Solo trae
`waba_id`, no `phone_number_id`**:

```json
{
  "data": { "waba_id": "<CUSTOMER_WABA_ID>" },
  "type": "WA_EMBEDDED_SIGNUP",
  "event": "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
  "version": 3
}
```

El CRM exige `phone_number_id`, así que la conexión **no se guardaría y no
mostraría error**:

- `apps/web/src/features/whatsapp/WhatsAppConnect.tsx:100`: solo llama a
  `connect.mutate` si hay `phoneNumberId`.
- `packages/shared/src/schemas/whatsapp.schema.ts:58`: `phoneNumberId` es
  obligatorio.
- `apps/api/src/modules/whatsapp/whatsapp-connection.service.ts:175`
  (`connect`): hace el upsert por `phoneNumberId`.

**Arreglo previsto:**

- [ ] Esquema: `phoneNumberId` opcional, pero exigir `phoneNumberId` o `wabaId`.
- [ ] Frontend: llamar a `connect` con `code` + `wabaId` aunque falte
      `phoneNumberId`. Tratar también el evento `CANCEL` (tiene
      `error_message` / `current_step`) para mostrar el motivo.
- [ ] API: tras canjear el code, si falta `phoneNumberId`, obtenerlo con
      `GET /{waba_id}/phone_numbers?fields=id,display_phone_number` usando el
      token.
- [ ] Verificar después de conectar:
      `GET /{phone_number_id}?fields=is_on_biz_app,platform_type`. Debe
      devolver `is_on_biz_app: true` y `platform_type: "CLOUD_API"`.
- [ ] Probar simulando las respuestas de Meta (como se hizo con
      `subscribed_apps`), y luego con el número real.

---

## Bloqueo 3 · Embedded Signup v2 se da de baja el 2026-10-15

`WhatsAppConnect.tsx:104-113` abre el flujo con el formato **v2**:

```js
extras: {
  setup: {},
  featureType: "whatsapp_business_app_onboarding",
  sessionInfoVersion: "3",
}
```

Meta: *"Embedded signup v2 will be deprecated on October 15, 2026"* (la v3
también se retira en octubre de 2026). En **v4** el objeto va vacío
(`extras: {}`) y los productos se eligen en la **Configuration** de Facebook
Login for Business.

- [ ] Averiguar cómo se activa la coexistencia en v4 (no quedó claro en la
      documentación). Hacerlo con la app real, una vez aprobado el Tech Provider.
- [ ] Migrar `launch()` a v4 y probar el flujo completo.

---

## Ya hecho (sin commitear todavía)

`apps/api/src/modules/whatsapp/whatsapp-connection.service.ts`: después de
guardar la conexión, `connect()` ahora llama a:

1. `POST /{waba_id}/subscribed_apps`: sin esto no llegan los webhooks del
   número. Si falla, o no hay `waba_id`, el canal queda **en error** con el
   motivo visible en el panel.
2. Solo en coexistencia, `POST /{phone_number_id}/smb_app_data` con
   `sync_type` `smb_app_state_sync` (contactos) y `history` (historial). Si
   falla, solo se registra un aviso en el log. Meta exige hacerlo **en las
   24 h** siguientes a conectar; si no, hay que desconectar y repetir el flujo.

Probado con typecheck y simulando Meta. **No probado contra Meta real.**

- [ ] Commit y push de este cambio.

---

## Configuración de Meta (checklist)

App de tipo **Business** con los productos **WhatsApp** y
**Facebook Login for Business**.

- [ ] *App settings → Basic*: App ID, App Secret, App Domains
      `crm.flyteek.com` y URL de política de privacidad.
- [ ] *Facebook Login for Business → Settings*: *Login with the JavaScript SDK*
      activado, *Allowed Domains* `https://crm.flyteek.com`.
- [ ] *Facebook Login for Business → Configurations*: configuración de
      **WhatsApp Embedded Signup**; copiar el **Config ID**.
- [ ] *WhatsApp → Configuration → Webhook*:
  - Callback URL: `https://crm.flyteek.com/api/v1/whatsapp/webhook`
  - Verify token: el mismo que `WHATSAPP_VERIFY_TOKEN`
  - Campos: `messages`, `smb_message_echoes`, `history`, `smb_app_state_sync`

---

## Variables en el VPS (`~/crm-prime/.env`)

```env
WHATSAPP_APP_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
NEXT_PUBLIC_WHATSAPP_APP_ID=      # mismo valor que WHATSAPP_APP_ID
NEXT_PUBLIC_WHATSAPP_CONFIG_ID=
```

`WHATSAPP_APP_SECRET` y `WHATSAPP_VERIFY_TOKEN` también se pueden cargar en
*Ajustes › Integraciones* del CRM. Las `NEXT_PUBLIC_*` se guardan en la imagen
del frontend al construirla, así que siempre hay que usar `--build`.

```bash
cd ~/crm-prime
git pull
docker compose -f docker-compose.prod.yml up -d --build api web
docker exec crm-api printenv WHATSAPP_APP_ID
docker logs crm-api 2>&1 | grep -i whatsapp | tail -20
```

> En el VPS usa siempre `-f docker-compose.prod.yml`. `docker-compose.yml` es
> solo de desarrollo y publica Postgres y Redis a internet.

---

## Después de conectar (a tener en cuenta)

- Los mensajes llegan al celular y al CRM; lo enviado desde el celular también
  aparece en el CRM (`smb_message_echoes`).
- Abrir WhatsApp Business en el celular con regularidad: Meta desconecta la
  coexistencia si la app pasa mucho tiempo sin usarse.
- Rendimiento fijo de 20 mensajes/segundo en coexistencia.
- Lo enviado desde el CRM paga la tarifa de la API; fuera de la ventana de
  24 h hay que usar plantillas.

---

## Fuentes

- Coexistencia: https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users
- Implementación de Embedded Signup: https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation
- Versiones (v2/v3/v4): https://developers.facebook.com/docs/whatsapp/embedded-signup/versions
