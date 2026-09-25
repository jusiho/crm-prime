-- Varios embudos por empresa + entrada automática de WhatsApp + descarte.
--
-- Cada empresa recibe un embudo "Ventas" predeterminado con las etapas que ya
-- tenía; la entrada automática queda apagada (se activa desde Ajustes). Las
-- empresas nuevas la traen activada desde el alta.

CREATE TABLE "pipelines" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "inboundEnabled" BOOLEAN NOT NULL DEFAULT false,
  "inboundStageId" TEXT,
  "inboundDiscardDays" INTEGER NOT NULL DEFAULT 7,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pipelines_orgId_idx" ON "pipelines"("orgId");
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un embudo por empresa, con lo que ya había.
INSERT INTO "pipelines" ("id", "orgId", "name", "order", "isDefault")
SELECT 'pl_' || o."id", o."id", 'Ventas', 0, true FROM "organizations" o;

ALTER TABLE "pipeline_stages" ADD COLUMN "pipelineId" TEXT;
UPDATE "pipeline_stages" SET "pipelineId" = 'pl_' || "orgId";
ALTER TABLE "pipeline_stages" ALTER COLUMN "pipelineId" SET NOT NULL;
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipelineId_fkey"
  FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- El orden ahora es único por embudo, no por empresa.
DROP INDEX IF EXISTS "pipeline_stages_orgId_order_key";
ALTER TABLE "pipeline_stages" DROP CONSTRAINT IF EXISTS "pipeline_stages_orgId_order_key";
CREATE UNIQUE INDEX "pipeline_stages_pipelineId_order_key" ON "pipeline_stages"("pipelineId", "order");
CREATE INDEX "pipeline_stages_orgId_idx" ON "pipeline_stages"("orgId");

-- Etapa de entrada del embudo: la primera que tenía cada empresa.
UPDATE "pipelines" p SET "inboundStageId" = (
  SELECT s."id" FROM "pipeline_stages" s
  WHERE s."pipelineId" = p."id" ORDER BY s."order" ASC LIMIT 1
);

-- Oportunidades descartadas.
ALTER TABLE "deals" ADD COLUMN "discardedAt" TIMESTAMP(3);
ALTER TABLE "deals" ADD COLUMN "discardReason" TEXT;
CREATE INDEX "deals_orgId_discardedAt_idx" ON "deals"("orgId", "discardedAt");

-- Cada número de WhatsApp puede entrar a un embudo distinto.
ALTER TABLE "whatsapp_connections" ADD COLUMN "pipelineId" TEXT;
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_pipelineId_fkey"
  FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Aislamiento por empresa, como el resto de tablas con orgId.
ALTER TABLE "pipelines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipelines_tenant_isolation" ON "pipelines"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );
