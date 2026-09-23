-- Multi-inquilino, fase 1: la columna `orgId` en todas las tablas raíz.
--
-- Se escribe a mano porque hay datos: una columna NOT NULL no se puede añadir
-- de golpe sobre filas existentes. El orden es siempre el mismo —
-- añadir NULL, rellenar, marcar NOT NULL — y así la migración corre sin
-- ventana de mantenimiento.
--
-- Todo lo que ya existe pasa a una organización por defecto, así que el
-- comportamiento del CRM no cambia: sigue habiendo una sola empresa.

-- ── 1. Organizaciones ────────────────────────────────────────
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- Id fijo y legible en vez de un cuid: esta fila se referencia desde el seed y
-- desde el arranque de la app, y conviene poder reconocerla en la base.
INSERT INTO "organizations" ("id", "slug", "name", "updatedAt")
VALUES ('org_default', 'default', 'Mi empresa', CURRENT_TIMESTAMP);

-- ── 2. Columna orgId: añadir, rellenar, exigir ───────────────
ALTER TABLE "users" ADD COLUMN "orgId" TEXT;
ALTER TABLE "contacts" ADD COLUMN "orgId" TEXT;
ALTER TABLE "custom_fields" ADD COLUMN "orgId" TEXT;
ALTER TABLE "products" ADD COLUMN "orgId" TEXT;
ALTER TABLE "sources" ADD COLUMN "orgId" TEXT;
ALTER TABLE "tags" ADD COLUMN "orgId" TEXT;
ALTER TABLE "conversations" ADD COLUMN "orgId" TEXT;
ALTER TABLE "messages" ADD COLUMN "orgId" TEXT;
ALTER TABLE "templates" ADD COLUMN "orgId" TEXT;
ALTER TABLE "pipeline_stages" ADD COLUMN "orgId" TEXT;
ALTER TABLE "deals" ADD COLUMN "orgId" TEXT;
ALTER TABLE "knowledge_docs" ADD COLUMN "orgId" TEXT;
ALTER TABLE "whatsapp_connections" ADD COLUMN "orgId" TEXT;
ALTER TABLE "api_keys" ADD COLUMN "orgId" TEXT;
ALTER TABLE "webhook_subscriptions" ADD COLUMN "orgId" TEXT;
ALTER TABLE "flows" ADD COLUMN "orgId" TEXT;
ALTER TABLE "agent_configs" ADD COLUMN "orgId" TEXT;
ALTER TABLE "ai_settings" ADD COLUMN "orgId" TEXT;
ALTER TABLE "integration_settings" ADD COLUMN "orgId" TEXT;

UPDATE "users" SET "orgId" = 'org_default';
UPDATE "contacts" SET "orgId" = 'org_default';
UPDATE "custom_fields" SET "orgId" = 'org_default';
UPDATE "products" SET "orgId" = 'org_default';
UPDATE "sources" SET "orgId" = 'org_default';
UPDATE "tags" SET "orgId" = 'org_default';
UPDATE "conversations" SET "orgId" = 'org_default';
UPDATE "messages" SET "orgId" = 'org_default';
UPDATE "templates" SET "orgId" = 'org_default';
UPDATE "pipeline_stages" SET "orgId" = 'org_default';
UPDATE "deals" SET "orgId" = 'org_default';
UPDATE "knowledge_docs" SET "orgId" = 'org_default';
UPDATE "whatsapp_connections" SET "orgId" = 'org_default';
UPDATE "api_keys" SET "orgId" = 'org_default';
UPDATE "webhook_subscriptions" SET "orgId" = 'org_default';
UPDATE "flows" SET "orgId" = 'org_default';
UPDATE "agent_configs" SET "orgId" = 'org_default';
UPDATE "ai_settings" SET "orgId" = 'org_default';
UPDATE "integration_settings" SET "orgId" = 'org_default';

ALTER TABLE "users" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "contacts" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "custom_fields" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "sources" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "tags" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "conversations" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "messages" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "templates" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "pipeline_stages" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "deals" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "knowledge_docs" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "whatsapp_connections" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "api_keys" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "webhook_subscriptions" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "flows" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "agent_configs" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "ai_settings" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "integration_settings" ALTER COLUMN "orgId" SET NOT NULL;

-- ── 3. Claves foráneas ───────────────────────────────────────
-- ON DELETE CASCADE: borrar una organización se lleva sus datos por delante.
-- Es deliberado; el borrado de verdad es el último paso del ciclo de baja.
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sources" ADD CONSTRAINT "sources_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tags" ADD CONSTRAINT "tags_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "templates" ADD CONSTRAINT "templates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_docs" ADD CONSTRAINT "knowledge_docs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flows" ADD CONSTRAINT "flows_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4. Unicidades que pasan a ser por organización ───────────
-- Dos empresas distintas pueden tener el mismo cliente, la misma etiqueta
-- "Interesado" o el mismo SKU. Global, esto haría que la segunda empresa no
-- pudiera dar de alta a su propio cliente.
DROP INDEX "contacts_phone_key";
CREATE UNIQUE INDEX "contacts_orgId_phone_key" ON "contacts"("orgId", "phone");

DROP INDEX "custom_fields_key_key";
CREATE UNIQUE INDEX "custom_fields_orgId_key_key" ON "custom_fields"("orgId", "key");

DROP INDEX "products_sku_key";
CREATE UNIQUE INDEX "products_orgId_sku_key" ON "products"("orgId", "sku");

DROP INDEX "sources_name_key";
CREATE UNIQUE INDEX "sources_orgId_name_key" ON "sources"("orgId", "name");

DROP INDEX "tags_name_key";
CREATE UNIQUE INDEX "tags_orgId_name_key" ON "tags"("orgId", "name");

DROP INDEX "tags_waLabelId_key";
CREATE UNIQUE INDEX "tags_orgId_waLabelId_key" ON "tags"("orgId", "waLabelId");

DROP INDEX "templates_waTemplateId_key";
CREATE UNIQUE INDEX "templates_orgId_waTemplateId_key" ON "templates"("orgId", "waTemplateId");

DROP INDEX "pipeline_stages_order_key";
CREATE UNIQUE INDEX "pipeline_stages_orgId_order_key" ON "pipeline_stages"("orgId", "order");

-- Las que NO cambian, y por qué:
--   messages.waMessageId        — lo genera Meta y es único en el mundo; es la
--                                 clave de idempotencia de los webhooks.
--   whatsapp_connections.phoneNumberId — es lo único que trae el webhook de Meta
--                                 para saber de qué organización es el mensaje.
--   api_keys.prefix             — hay que resolver la clave ANTES de saber la
--                                 organización; por eso es un secreto aleatorio.
--   users.email                 — sigue siendo global hasta la fase 3, que es
--                                 la que cambia la pantalla de acceso.

-- ── 5. Las dos tablas de "fila única" pasan a una por organización ──
ALTER TABLE "ai_settings" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "integration_settings" ALTER COLUMN "id" DROP DEFAULT;
CREATE UNIQUE INDEX "ai_settings_orgId_key" ON "ai_settings"("orgId");
CREATE UNIQUE INDEX "integration_settings_orgId_key" ON "integration_settings"("orgId");

-- ── 6. Índices ───────────────────────────────────────────────
-- En las tablas calientes el índice pasa a (orgId, …): con el filtro por
-- organización siempre presente, el índice de una sola columna deja de servir.
DROP INDEX "contacts_lastMessageAt_idx";
CREATE INDEX "contacts_orgId_lastMessageAt_idx" ON "contacts"("orgId", "lastMessageAt");

DROP INDEX "conversations_status_idx";
CREATE INDEX "conversations_orgId_status_idx" ON "conversations"("orgId", "status");

DROP INDEX "conversations_lastMessageAt_idx";
CREATE INDEX "conversations_orgId_lastMessageAt_idx" ON "conversations"("orgId", "lastMessageAt");

DROP INDEX "deals_stageId_idx";
CREATE INDEX "deals_orgId_stageId_idx" ON "deals"("orgId", "stageId");

CREATE INDEX "messages_orgId_createdAt_idx" ON "messages"("orgId", "createdAt");

-- En el resto basta el índice suelto: no hay una consulta caliente que combine.
CREATE INDEX "users_orgId_idx" ON "users"("orgId");
CREATE INDEX "knowledge_docs_orgId_idx" ON "knowledge_docs"("orgId");
CREATE INDEX "whatsapp_connections_orgId_idx" ON "whatsapp_connections"("orgId");
CREATE INDEX "api_keys_orgId_idx" ON "api_keys"("orgId");
CREATE INDEX "webhook_subscriptions_orgId_idx" ON "webhook_subscriptions"("orgId");
CREATE INDEX "agent_configs_orgId_idx" ON "agent_configs"("orgId");
CREATE INDEX "flows_orgId_idx" ON "flows"("orgId");

-- ── 7. Un solo bot de respaldo por organización ──────────────
-- El bot con `isDefault` es el que atiende los canales sin bot propio. Que
-- haya dos es un estado inconsistente que hoy nadie impide: se coge "el
-- primero" y el resultado depende del orden de inserción. Un índice único
-- parcial lo vuelve imposible. Prisma no sabe expresarlo, así que va aquí.
-- Si ya hubiera más de uno, se degradan los sobrantes en vez de borrarlos:
-- la configuración de un bot es trabajo de alguien.
UPDATE "agent_configs" a SET "isDefault" = false
 WHERE a."isDefault"
   AND a.id <> (SELECT b.id FROM "agent_configs" b
                 WHERE b."isDefault" AND b."orgId" = a."orgId"
                 ORDER BY b."createdAt" ASC LIMIT 1);

CREATE UNIQUE INDEX "agent_configs_one_default_per_org"
    ON "agent_configs"("orgId") WHERE "isDefault";
