-- Fecha de cierre de las oportunidades, para el panel ("ventas ganadas por día").
--
-- La mantiene un trigger y no el código: la etapa cambia desde el tablero, el
-- agente de IA, los flujos, la API pública y los leads de Meta, y olvidar uno
-- dejaría ventas sin fecha. Se fija al entrar en una etapa de ganado/perdido y
-- se borra al salir de ella.

ALTER TABLE "deals" ADD COLUMN "closedAt" TIMESTAMP(3);

-- Histórico: las que ya están cerradas toman su última modificación.
UPDATE "deals" d SET "closedAt" = d."updatedAt"
FROM "pipeline_stages" s
WHERE s."id" = d."stageId" AND (s."isWon" OR s."isLost");

CREATE INDEX "deals_orgId_closedAt_idx" ON "deals"("orgId", "closedAt");

CREATE OR REPLACE FUNCTION deals_set_closed_at() RETURNS trigger AS $$
DECLARE
  cerrada boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."stageId" IS NOT DISTINCT FROM OLD."stageId" THEN
    RETURN NEW;
  END IF;
  SELECT (s."isWon" OR s."isLost") INTO cerrada FROM "pipeline_stages" s WHERE s."id" = NEW."stageId";
  IF coalesce(cerrada, false) THEN
    NEW."closedAt" := now();
  ELSE
    NEW."closedAt" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deals_closed_at
  BEFORE INSERT OR UPDATE OF "stageId" ON "deals"
  FOR EACH ROW EXECUTE FUNCTION deals_set_closed_at();
