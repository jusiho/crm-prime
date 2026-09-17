# CRM Prime

**A WhatsApp CRM with AI agents.** It brings the conversations of all your
numbers into one real-time inbox, automates replies with AI agents and visual
flows, and ties those chats to the business: sales pipeline, contacts, product
catalog and broadcasts.

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](./LICENSE)
[🇪🇸 Léeme en español](./README.es.md)

> **Status:** under active development. It works end to end against the WhatsApp
> Cloud API, but there is no stable release yet and no compatibility guarantee
> between versions.

---

## What it does

**Multi-number inbox.** Every conversation from every WhatsApp number in one
place, updated live over WebSocket. Each reply goes out through the same number
the message came in on. It supports *coexistence*: keep using the WhatsApp app on
the phone while your team works from the CRM (messages you send from the phone
show up here too).

**AI agents with two modes.** *Copilot* drafts the reply and a human reviews it
before sending; *Autopilot* replies on its own. The agent can look up the product
catalog, search your knowledge base (RAG) and **act on the CRM**: tag the
contact, move them along the pipeline, update their record, assign a seller or
send them a product photo.

In copilot those actions **wait for approval** and are only applied when the
human sends the reply.

**Visual flow builder.** Node-based automations (send a message, ask and store,
condition, wait, HTTP call, assign, jump to another flow). It includes an
assistant that builds the flow from a plain-language description.

**Sales pipeline.** A kanban of deals with configurable stages, an owner per
seller and totals per stage.

**Contacts.** A directory with tags, custom fields, commercial source and
**technical origin** (which API created each contact: ad, WhatsApp, webhook,
import). It captures Click-to-WhatsApp ad attribution (including `ctwa_clid` for
the Conversions API) and `utm_*` parameters.

**Broadcasts.** Bulk sends with Meta-approved templates, segmented by tags.

**Knowledge base (RAG).** Documents chunked and vectorized with pgvector so the
agent answers with your information instead of making things up.

**API keys.** Issue credentials per integration (n8n, Zapier, a landing page)
with scopes and revocation, to receive leads from outside systems.

**Two languages.** The interface ships in English and Spanish, and API error
messages follow the language the browser asks for.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 10 · Prisma 6 · PostgreSQL + pgvector · BullMQ on Redis |
| Frontend | Next.js 15 (App Router) · React 19 · TanStack Query · NextAuth |
| Shared | Zod — one schema validates in the API, the web and a future mobile app |
| Messaging | WhatsApp Business Cloud API (Meta) |
| AI | OpenAI or Anthropic, interchangeable · Voyage AI for embeddings |

```
apps/
  api/      NestJS — REST API, Prisma, queues, AI, WhatsApp
  web/      Next.js — UI + BFF (the JWT lives in an httpOnly cookie, never in the browser)
packages/
  shared/   Zod schemas + shared types
```

The architecture uses the adapter pattern for the three external integrations
(WhatsApp, LLM, file storage), so each one has a real implementation and a
simulated one. **The CRM boots and runs with no credentials at all**: the
simulated adapters log what they would do and return synthetic responses.

---

## Getting started

You need **Node.js ≥ 20** and **Docker**.

```bash
git clone https://github.com/jusiho/crm-prime.git
cd crm-prime
npm install
npm run setup     # creates .env, starts Docker, migrates and seeds
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- Demo login: **admin@crm.local** / **admin1234**

`npm run setup` is idempotent: run it again whenever you want. It never
overwrites an existing `.env` and never duplicates data. It generates its own
random secrets, waits for Postgres to accept connections and enables pgvector
with its vector index.

> If `prisma generate` fails with `EPERM` on Windows, a dev server is holding the
> client. Close it and run `npm run setup` again.

### Just try it, install nothing

```bash
npm run demo      # or: docker compose -f docker-compose.demo.yml up --build
```

This starts the whole CRM in containers (database, Redis, API and web) with data
already seeded. **Not for production**: the secrets are in plain sight. To deploy
for real, use `docker-compose.prod.yml`.

---

## Environment variables

> **The values in `.env.example` are public.** They live in this repository, so a
> `.env` copied as-is uses secrets anyone can read. `npm run setup` generates its
> own; if you write the `.env` by hand, change them before exposing anything to
> the internet.

Only three are required to boot:

| Variable | What it is for |
|---|---|
| `DATABASE_URL` | Postgres |
| `JWT_ACCESS_SECRET` | Signing access tokens |
| `AUTH_SECRET` | NextAuth session on the web |

The rest are optional and **most can be set from the panel**, which takes
precedence over `.env`:

| Variable | Where it is set in the UI |
|---|---|
| `OPENAI_API_KEY` · `ANTHROPIC_API_KEY` | Settings › Artificial Intelligence |
| `VOYAGE_API_KEY` | Settings › Integrations |
| `WHATSAPP_APP_SECRET` · `WHATSAPP_VERIFY_TOKEN` | Settings › Integrations |
| `WHATSAPP_TOKEN` · `WHATSAPP_PHONE_NUMBER_ID` | Settings › Channels (per number) |

Credentials saved from the panel are encrypted with AES-256-GCM using
`APP_ENCRYPTION_KEY` (if you don't set it, it is derived from
`JWT_ACCESS_SECRET`).

> A variable that is declared but **empty** counts as undefined. Leaving
> `OPENAI_BASE_URL=""` breaks nothing: the default is used.

---

## Connecting WhatsApp

1. In Meta → your app → WhatsApp → **API Setup**, copy the *Phone number ID* and
   an access token.
2. In the CRM: **Settings › Channels → Add a number manually** and paste both.
3. To **receive** messages, Meta needs to reach your API over HTTPS. Locally:

   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```

4. In Meta → WhatsApp → Configuration → Webhooks:
   - **Callback URL**: `https://YOUR-TUNNEL/api/v1/whatsapp/webhook`
   - **Verify token**: the one in Settings › Integrations
   - Subscribe to the `messages` and `message_echoes` fields

Three things that usually go wrong without a clear error:

- The app must be in **Live** mode; in *Development* Meta withholds some
  webhooks.
- **Subscribing to the `messages` field is not enough**: the WhatsApp Business
  Account (WABA) has to be subscribed to your app. Check it with
  `GET /{waba-id}/subscribed_apps`; if you only see a Meta app there, yours is
  missing.
- The **temporary token expires in 24 hours**. For something stable, use a system
  user token with expiry set to *Never*.

---

## Receiving external leads

Create a key in **Settings › API keys** with the `leads:write` scope:

```bash
curl -X POST https://your-crm/api/v1/webhooks/lead \
  -H "Authorization: Bearer crm_xxxx_xxxx" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+51999888777","name":"Ana","source":"Facebook Ads"}'
```

The key's name is recorded as the contact's origin, so you know which
integration created it without trusting whatever the caller claims.

Leads from **Meta lead forms** (Facebook and Instagram) come in on their own:
connect your pages in **Settings › Meta leads**.

---

## Languages

The interface is available in **English (default)** and **Spanish**. Each person
picks theirs from the header; the choice is stored in a cookie, so the server
already knows it when rendering and nothing flickers.

To add a language: copy `apps/web/src/i18n/messages/en.ts`, translate the values,
register it in `apps/web/src/i18n/config.ts` and add its dictionary in
`apps/web/src/i18n/server.ts`. TypeScript will flag any key you forget.

API error messages are translated at the edge, based on the browser's
`Accept-Language`. A check makes sure none is left behind:

```bash
npm run check:i18n -w @crm/api
```

---

## Development

```bash
npm run dev                   # api + web
npm run dev -w @crm/api       # API only (port 3001)
npm run dev -w @crm/web       # web only (port 3000)

npm run typecheck             # TypeScript across the monorepo
npm run lint
```

If you touch `packages/shared`, rebuild it (`npm run build -w @crm/shared`) so
the api and the web see the new types.

---

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md)
for the workflow and code conventions.

---

## License

[AGPL-3.0](./LICENSE).

You can use, modify and deploy this software freely. If you offer it as a service
to third parties, the AGPL requires you to publish your modifications. For uses
that don't fit that condition, contact the authors for a commercial license.
