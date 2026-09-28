-- Primeros pasos con seguimiento: estado por empresa (pasos omitidos, lista
-- oculta) y, por usuario, los tours de pantalla ya vistos.

ALTER TABLE "users" ADD COLUMN "toursSeen" TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE "onboarding_states" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "skipped" TEXT[] NOT NULL DEFAULT '{}',
  "done" TEXT[] NOT NULL DEFAULT '{}',
  "dismissedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "onboarding_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onboarding_states_orgId_key" ON "onboarding_states"("orgId");

ALTER TABLE "onboarding_states" ADD CONSTRAINT "onboarding_states_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aislamiento por empresa, como el resto de tablas con orgId.
ALTER TABLE "onboarding_states" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding_states_tenant_isolation" ON "onboarding_states"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );
