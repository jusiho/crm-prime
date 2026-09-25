-- Fuente automática para los contactos que entraron por WhatsApp antes de que
-- el CRM la asignara solo. Crea "WhatsApp" (y "Anuncio de Meta" donde haga
-- falta) en cada empresa y la pone a los contactos que no tienen ninguna.
-- Una fuente puesta a mano no se toca.

INSERT INTO "sources" ("id", "orgId", "name", "color", "createdAt")
SELECT 'src_wa_' || o."id", o."id", 'WhatsApp', '#25d366', now()
FROM "organizations" o
WHERE NOT EXISTS (
  SELECT 1 FROM "sources" s WHERE s."orgId" = o."id" AND s."name" = 'WhatsApp'
);

INSERT INTO "sources" ("id", "orgId", "name", "color", "createdAt")
SELECT 'src_ad_' || o."id", o."id", 'Anuncio de Meta', '#1877f2', now()
FROM "organizations" o
WHERE EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."orgId" = o."id" AND c."sourceId" IS NULL AND c."origin" = 'ad'
)
AND NOT EXISTS (
  SELECT 1 FROM "sources" s WHERE s."orgId" = o."id" AND s."name" = 'Anuncio de Meta'
);

UPDATE "contacts" c
SET "sourceId" = s."id"
FROM "sources" s
WHERE c."sourceId" IS NULL
  AND s."orgId" = c."orgId"
  AND s."name" = 'WhatsApp'
  AND (
    c."origin" = 'whatsapp'
    OR (c."origin" = 'import' AND c."originDetail" = 'Sincronización de WhatsApp')
  );

UPDATE "contacts" c
SET "sourceId" = s."id"
FROM "sources" s
WHERE c."sourceId" IS NULL
  AND s."orgId" = c."orgId"
  AND s."name" = 'Anuncio de Meta'
  AND c."origin" = 'ad';
