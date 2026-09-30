-- Copiloto: memoria del cliente y preguntas sin respuesta del conocimiento.

ALTER TABLE "contacts" ADD COLUMN "aiMemory" JSONB;
ALTER TABLE "contacts" ADD COLUMN "aiMemoryAt" TIMESTAMP(3);

CREATE TABLE "knowledge_suggestions" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL DEFAULT '',
  "occurrences" INTEGER NOT NULL DEFAULT 1,
  "conversationIds" TEXT[] NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_suggestions_orgId_status_idx" ON "knowledge_suggestions"("orgId", "status");

ALTER TABLE "knowledge_suggestions" ADD CONSTRAINT "knowledge_suggestions_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aislamiento por empresa, como el resto de tablas con orgId.
ALTER TABLE "knowledge_suggestions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_suggestions_tenant_isolation" ON "knowledge_suggestions"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );
