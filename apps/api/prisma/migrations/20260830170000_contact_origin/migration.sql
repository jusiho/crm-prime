-- Procedencia técnica del contacto (por qué API/pantalla entró).
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "originDetail" TEXT;
CREATE INDEX IF NOT EXISTS "contacts_origin_idx" ON "contacts"("origin");
