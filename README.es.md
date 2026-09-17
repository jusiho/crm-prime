# CRM Prime

**CRM para WhatsApp con agentes de IA.** Centraliza las conversaciones de varios
números en una bandeja en tiempo real, automatiza la atención con bots y flujos
visuales, y conecta esa conversación con el negocio: pipeline de ventas,
contactos, catálogo de productos y campañas.

[![Licencia: AGPL v3](https://img.shields.io/badge/licencia-AGPL--3.0-blue.svg)](./LICENSE)
[🇬🇧 Read me in English](./README.md)

> **Estado:** en desarrollo activo. Funciona de punta a punta contra la
> WhatsApp Cloud API, pero todavía no hay release estable ni garantía de
> compatibilidad entre versiones.

---

## Qué hace

**Bandeja multi-número.** Todas las conversaciones de todos tus números de
WhatsApp en un sitio, con actualización en vivo por WebSocket. Cada respuesta
sale por el mismo número por el que entró el mensaje. Soporta *coexistencia*:
seguir usando la app de WhatsApp en el celular mientras gestionas desde el CRM
(los mensajes que escribes desde el móvil también aparecen aquí).

**Agentes de IA con dos modos.** *Copilot* redacta la respuesta y un humano la
revisa antes de enviar; *Autopilot* responde solo. El agente puede consultar el
catálogo de productos, buscar en tu base de conocimiento (RAG), y **ejecutar
acciones sobre el CRM**: etiquetar el contacto, moverlo de etapa en el pipeline,
actualizar su ficha, asignarle un vendedor o enviarle la foto de un producto.

En copilot esas acciones **quedan pendientes de aprobación** y solo se aplican
cuando el agente humano envía la respuesta.

**Constructor visual de flujos.** Automatizaciones tipo diagrama de nodos
(enviar mensaje, preguntar y guardar, condición, esperar, llamada HTTP, asignar,
saltar a otro flujo). Incluye un asistente que construye el flujo a partir de una
descripción en lenguaje natural.

**Pipeline de ventas.** Kanban de oportunidades con etapas configurables, dueño
por vendedor y totales por etapa.

**Contactos.** Directorio con etiquetas, campos personalizados, fuente comercial
y **procedencia técnica** (por qué API entró cada contacto: anuncio, WhatsApp,
webhook, importación). Captura la atribución de los anuncios Click-to-WhatsApp
(incluido el `ctwa_clid` para la Conversions API) y los `utm_*`.

**Campañas.** Envíos masivos con plantillas aprobadas por Meta, segmentando por
etiquetas.

**Base de conocimiento (RAG).** Documentos troceados y vectorizados con pgvector
para que el bot responda con información tuya en vez de inventar.

**Claves de API.** Emite credenciales por integración (n8n, Zapier, una landing)
con ámbitos y revocación, para recibir leads de sistemas externos.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | NestJS 10 · Prisma 6 · PostgreSQL + pgvector · BullMQ sobre Redis |
| Frontend | Next.js 15 (App Router) · React 19 · TanStack Query · NextAuth |
| Compartido | Zod — un solo esquema valida en API, web y futura app móvil |
| Mensajería | WhatsApp Business Cloud API (Meta) |
| IA | OpenAI o Anthropic, intercambiables · Voyage AI para embeddings |

```
apps/
  api/      NestJS — API REST, Prisma, colas, IA, WhatsApp
  web/      Next.js — UI + BFF (el JWT vive en cookie httpOnly, nunca en el navegador)
packages/
  shared/   Zod + tipos compartidos
```

La arquitectura usa el patrón adaptador en las tres integraciones externas
(WhatsApp, LLM, almacenamiento de archivos), así que cada una tiene su
implementación real y una simulada. **El CRM arranca y funciona sin credenciales
de nada**: los adaptadores simulados registran en log y devuelven respuestas
sintéticas.

---

## Puesta en marcha

Necesitas **Node.js ≥ 20** y **Docker**.

```bash
git clone https://github.com/jusiho/crm-prime.git
cd crm-prime
npm install
npm run setup     # crea el .env, levanta Docker, migra y siembra
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- Acceso de prueba: **admin@crm.local** / **admin1234**

`npm run setup` es idempotente: puedes relanzarlo cuando quieras. No pisa un
`.env` existente ni duplica datos. Genera secretos aleatorios propios, espera a
que Postgres acepte conexiones y habilita pgvector con su índice vectorial.

> Si `prisma generate` falla con `EPERM` en Windows, hay un servidor de
> desarrollo usando el cliente. Ciérralo y relanza `npm run setup`.

### Solo probarlo, sin instalar nada

```bash
npm run demo      # o: docker compose -f docker-compose.demo.yml up --build
```

Levanta el CRM entero en contenedores (base de datos, Redis, API y web) con
datos ya sembrados. **No es para producción**: los secretos están a la vista.
Para desplegar de verdad, `docker-compose.prod.yml`.

---

## Variables de entorno

> **Los valores de `.env.example` son públicos.** Están en este repositorio, así
> que un `.env` copiado tal cual usa secretos que cualquiera puede leer.
> `npm run setup` genera los suyos; si creas el `.env` a mano, cámbialos antes
> de exponer nada a internet.

Solo tres son obligatorias para arrancar:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Postgres |
| `JWT_ACCESS_SECRET` | Firma de los tokens de acceso |
| `AUTH_SECRET` | Sesión de NextAuth en la web |

El resto son opcionales y **casi todas se pueden configurar desde el panel**, que
manda sobre el `.env`:

| Variable | Dónde se configura en la UI |
|---|---|
| `OPENAI_API_KEY` · `ANTHROPIC_API_KEY` | Ajustes › Inteligencia Artificial |
| `VOYAGE_API_KEY` | Ajustes › Integraciones |
| `WHATSAPP_APP_SECRET` · `WHATSAPP_VERIFY_TOKEN` | Ajustes › Integraciones |
| `WHATSAPP_TOKEN` · `WHATSAPP_PHONE_NUMBER_ID` | Ajustes › Canales (por número) |

Las credenciales guardadas desde el panel se cifran con AES-256-GCM usando
`APP_ENCRYPTION_KEY` (si no la defines, se deriva de `JWT_ACCESS_SECRET`).

> Una variable declarada pero **vacía** cuenta como no definida. Si dejas
> `OPENAI_BASE_URL=""` no se rompe nada: se usa el valor por defecto.

---

## Conectar WhatsApp

1. En Meta → tu app → WhatsApp → **API Setup**, copia el *Phone number ID* y un
   token de acceso.
2. En el CRM: **Ajustes › Canales → Añadir un número a mano** y pega ambos.
3. Para **recibir** mensajes, Meta necesita alcanzar tu API por HTTPS. En local:

   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```

4. En Meta → WhatsApp → Configuración → Webhooks:
   - **Callback URL**: `https://TU-TUNEL/api/v1/whatsapp/webhook`
   - **Verify token**: el de Ajustes › Integraciones
   - Suscribe los campos `messages` y `message_echoes`

Tres cosas que suelen fallar y no dan error claro:

- La app tiene que estar en modo **Live**; en *Desarrollo* Meta no entrega
  algunos webhooks.
- **Suscribir el campo `messages` no basta**: la cuenta de WhatsApp Business
  (WABA) tiene que estar suscrita a tu app. Compruébalo con
  `GET /{waba-id}/subscribed_apps`; si solo aparece una app de Meta, falta la tuya.
- El **token temporal caduca en 24 h**. Para algo estable, usa un token de
  usuario de sistema con caducidad *Nunca*.

---

## Recibir leads externos

Crea una clave en **Ajustes › Claves de API** con el ámbito `leads:write`:

```bash
curl -X POST https://tu-crm/api/v1/webhooks/lead \
  -H "Authorization: Bearer crm_xxxx_xxxx" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+51999888777","name":"Ana","source":"Facebook Ads"}'
```

El nombre de la clave queda como procedencia del contacto, así que sabes qué
integración lo creó sin fiarte de lo que declare quien llama.

---

## Desarrollo

```bash
npm run dev                   # api + web
npm run dev -w @crm/api       # solo la API (puerto 3001)
npm run dev -w @crm/web       # solo la web (puerto 3000)

npm run typecheck             # TypeScript en todo el monorepo
npm run lint
```

Si tocas `packages/shared`, recompílalo (`npm run build -w @crm/shared`) para que
api y web vean los tipos nuevos.

---

## Contribuir

Se aceptan issues y pull requests. Lee [CONTRIBUTING.md](./CONTRIBUTING.md) para
el flujo de trabajo y las convenciones del código.

---

## Licencia

[AGPL-3.0](./LICENSE).

Puedes usar, modificar y desplegar este software libremente. Si lo ofreces como
servicio a terceros, la AGPL te obliga a publicar tus modificaciones. Para usos
que no encajen con esa condición, contacta con los autores para una licencia
comercial.
