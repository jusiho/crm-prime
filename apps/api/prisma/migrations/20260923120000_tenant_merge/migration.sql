-- Multi-empresa para las tablas que llegaron por la rama de plantillas y
-- Meta Lead Ads.
--
-- Esas migraciones se crearon en paralelo a la multi-empresa, así que sus
-- tablas quedaron fuera: `meta_pages` y `quick_replies` no tenían `orgId`, y
-- eran raíces (ninguna cuelga de un padre obligatorio). Sin esto, las páginas
-- de Facebook y las respuestas rápidas de una empresa las verían todas.
--
-- Mismo patrón que la migración original: añadir NULL, rellenar, exigir.

-- ── 1. Columna orgId ─────────────────────────────────────────
ALTER TABLE "meta_pages" ADD COLUMN "orgId" TEXT;
ALTER TABLE "quick_replies" ADD COLUMN "orgId" TEXT;

-- Todo lo que ya existe va a la organización más antigua, que en una
-- instalación de una sola empresa es la única que hay.
UPDATE "meta_pages"
   SET "orgId" = (SELECT id FROM "organizations" ORDER BY "createdAt" ASC LIMIT 1)
 WHERE "orgId" IS NULL;
UPDATE "quick_replies"
   SET "orgId" = (SELECT id FROM "organizations" ORDER BY "createdAt" ASC LIMIT 1)
 WHERE "orgId" IS NULL;

-- Si la base estaba vacía de organizaciones, las tablas también lo estarán y
-- el NOT NULL pasa sin problema.
ALTER TABLE "meta_pages" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "quick_replies" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "meta_pages" ADD CONSTRAINT "meta_pages_orgId_fkey" FOREIGN KEY ("orgId")
  REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_orgId_fkey" FOREIGN KEY ("orgId")
  REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "meta_pages_orgId_idx" ON "meta_pages"("orgId");

-- ── 2. Unicidades que pasan a ser por empresa ────────────────
-- Dos negocios distintos pueden tener cada uno su atajo "/precio".
DROP INDEX "quick_replies_shortcut_key";
CREATE UNIQUE INDEX "quick_replies_orgId_shortcut_key" ON "quick_replies"("orgId", "shortcut");

-- Meta identifica una plantilla por nombre + idioma, pero eso vale DENTRO de
-- una WABA. Con la restricción global, la segunda empresa no podría crear su
-- propia plantilla "bienvenida" en español.
DROP INDEX "templates_name_language_key";
CREATE UNIQUE INDEX "templates_orgId_name_language_key" ON "templates"("orgId", "name", "language");

-- `meta_pages.pageId` se queda único global a propósito: una página de
-- Facebook pertenece a una sola empresa, igual que un número de WhatsApp, y es
-- lo único que trae el webhook de Meta para saber de quién es el lead.

-- ── 3. RLS para las dos tablas nuevas ────────────────────────
-- Las políticas de la migración de RLS no las cubrían porque entonces no
-- llevaban `orgId`. Duermen igual que el resto hasta que la aplicación se
-- conecte con el rol restringido.
ALTER TABLE "meta_pages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_pages_tenant_isolation" ON "meta_pages"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

ALTER TABLE "quick_replies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quick_replies_tenant_isolation" ON "quick_replies"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );

-- `meta_leads` cuelga de `meta_pages` por clave foránea obligatoria, así que
-- queda cubierta por la política de su padre igual que el resto de hijas.
