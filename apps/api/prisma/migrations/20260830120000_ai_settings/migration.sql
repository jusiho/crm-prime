-- Tabla singleton de credenciales/preferencias del proveedor de IA.
CREATE TABLE IF NOT EXISTS "ai_settings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "provider" TEXT NOT NULL DEFAULT 'auto',
  "openaiKeyEnc" TEXT,
  "anthropicKeyEnc" TEXT,
  "openaiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  "anthropicModel" TEXT NOT NULL DEFAULT 'claude-opus-4-8',
  "openaiBaseUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);
