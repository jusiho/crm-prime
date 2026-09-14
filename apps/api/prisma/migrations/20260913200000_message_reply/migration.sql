-- Cita estilo WhatsApp: mensaje al que responde otro.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;
CREATE INDEX IF NOT EXISTS "messages_replyToId_idx" ON "messages"("replyToId");
DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey"
    FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
