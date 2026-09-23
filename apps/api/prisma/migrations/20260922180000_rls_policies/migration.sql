-- Row-Level Security: la capa 2 del aislamiento.
--
-- La capa 1 (extensión de Prisma) evita el error humano en las consultas
-- normales. Esta evita el desastre cuando la capa 1 no llega: SQL crudo,
-- relaciones anidadas, un `$queryRawUnsafe` escrito con prisa.
--
-- ── Por qué esto se puede desplegar sin miedo ────────────────
-- En Postgres, el DUEÑO de una tabla se salta sus políticas salvo que se active
-- FORCE ROW LEVEL SECURITY. La aplicación se conecta hoy como dueña, así que
-- después de esta migración NO cambia absolutamente nada: las políticas quedan
-- creadas y dormidas.
--
-- Se despiertan el día que la aplicación se conecte con el rol restringido
-- (ver scripts/create-app-role.sql). Eso permite separar "desplegar el código"
-- de "activar la defensa", que son dos riesgos distintos y conviene no
-- juntarlos en la misma noche.
--
-- ── La variable de sesión ────────────────────────────────────
-- `current_setting('app.current_org', true)` devuelve NULL si nadie la fijó, y
-- `"orgId" = NULL` no es cierto para ninguna fila. Es decir: **falla cerrado**.
-- Una consulta que se olvide de fijar la organización devuelve cero filas, no
-- todas. Es el comportamiento correcto para un fallo de esta clase.
--
-- El valor '*' desactiva el filtro. Lo produce **solo** `runUnscoped()`, para
-- los cuatro sitios que tienen que averiguar de qué empresa es algo antes de
-- saberlo (login, webhook de Meta, clave de API).
--
-- ── Qué protege esto y qué no ────────────────────────────────
-- Protege contra el ERROR: una consulta sin filtrar, una relación anidada, un
-- SQL crudo escrito con prisa. También contra una inyección SQL corriente, que
-- se queda dentro del WHERE y no puede saltarse la política.
--
-- NO protege contra quien ya controle el proceso de la aplicación: ese puede
-- ejecutar `SET app.current_org` y ponerse donde quiera. Para eso la defensa
-- es no llegar ahí, no una política de base de datos.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_tenant_isolation" ON "users"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_tenant_isolation" ON "contacts"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "custom_fields" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_fields_tenant_isolation" ON "custom_fields"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_tenant_isolation" ON "products"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources_tenant_isolation" ON "sources"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_tenant_isolation" ON "tags"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_tenant_isolation" ON "conversations"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_tenant_isolation" ON "messages"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_tenant_isolation" ON "templates"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_stages_tenant_isolation" ON "pipeline_stages"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deals_tenant_isolation" ON "deals"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "knowledge_docs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_docs_tenant_isolation" ON "knowledge_docs"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "whatsapp_connections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whatsapp_connections_tenant_isolation" ON "whatsapp_connections"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_tenant_isolation" ON "api_keys"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "webhook_subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_subscriptions_tenant_isolation" ON "webhook_subscriptions"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "ai_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_settings_tenant_isolation" ON "ai_settings"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "integration_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration_settings_tenant_isolation" ON "integration_settings"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "agent_configs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_configs_tenant_isolation" ON "agent_configs"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "flows" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flows_tenant_isolation" ON "flows"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

-- knowledge_chunks no lleva `orgId` (cuelga de knowledge_docs), pero es la
-- ÚNICA tabla hija que se consulta con SQL crudo: la búsqueda vectorial del
-- RAG. Sin política aquí, el agente de una empresa podría recuperar los
-- documentos internos de otra y citarlos en una respuesta. Por eso lleva una
-- política con subconsulta, que es más cara pero se ejecuta sobre un índice.
ALTER TABLE "knowledge_chunks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_chunks_tenant_isolation" ON "knowledge_chunks"
  USING (
    current_setting('app.current_org', true) = '*'
    OR EXISTS (
      SELECT 1 FROM "knowledge_docs" d
       WHERE d.id = "knowledge_chunks"."docId"
         AND d."orgId" = current_setting('app.current_org', true)
    )
  );
