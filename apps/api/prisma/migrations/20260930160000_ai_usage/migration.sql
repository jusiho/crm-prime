-- Consumo de IA por empresa: una fila por llamada al modelo.

CREATE TABLE "ai_usage" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "conversationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_usage_orgId_createdAt_idx" ON "ai_usage"("orgId", "createdAt");

ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Histórico: lo que ya estaba registrado como ejecución del agente o del
-- copiloto (las ejecuciones sin bot son del copiloto). Lo demás empieza a
-- contarse desde aquí.
INSERT INTO "ai_usage" ("id", "orgId", "feature", "model", "inputTokens", "outputTokens", "conversationId", "createdAt")
SELECT 'bf_' || r."id", c."orgId",
       CASE WHEN r."agentConfigId" IS NULL THEN 'copilot' ELSE 'agent' END,
       r."model", r."inputTokens", r."outputTokens", r."conversationId", r."createdAt"
FROM "ai_runs" r
JOIN "conversations" c ON c."id" = r."conversationId"
WHERE r."model" NOT LIKE 'fake%' AND (r."inputTokens" > 0 OR r."outputTokens" > 0);

-- Aislamiento por empresa, como el resto de tablas con orgId.
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_tenant_isolation" ON "ai_usage"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );
