-- Anuncio Click-to-WhatsApp que abrió la conversación (payload `referral`).
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "referral" JSONB;
