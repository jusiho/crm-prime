-- Motivo por el que un canal de WhatsApp está en error (token caducado…).
ALTER TABLE "whatsapp_connections" ADD COLUMN IF NOT EXISTS "statusReason" TEXT;
