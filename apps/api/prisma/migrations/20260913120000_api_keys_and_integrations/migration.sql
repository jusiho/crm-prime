-- Claves de API emitidas por el CRM (integraciones entrantes).
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "scopes" TEXT[],
  "lastUsedAt" TIMESTAMP(3),
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_prefix_key" ON "api_keys"("prefix");
CREATE INDEX IF NOT EXISTS "api_keys_revokedAt_idx" ON "api_keys"("revokedAt");

DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Credenciales de terceros que consume el CRM (fila única).
CREATE TABLE IF NOT EXISTS "integration_settings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "voyageKeyEnc" TEXT,
  "voyageModel" TEXT NOT NULL DEFAULT 'voyage-3.5',
  "whatsappAppId" TEXT,
  "whatsappAppSecretEnc" TEXT,
  "whatsappVerifyTokenEnc" TEXT,
  "whatsappGraphVersion" TEXT NOT NULL DEFAULT 'v21.0',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);
