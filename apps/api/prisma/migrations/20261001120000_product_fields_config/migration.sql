-- Configuración de cada campo personalizado del catálogo: unidad, ayuda,
-- obligatorio, si se ve en la tarjeta y si lo usa el agente de IA.
ALTER TABLE "product_fields"
  ADD COLUMN "unit" TEXT,
  ADD COLUMN "help" TEXT,
  ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showOnCard" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "aiVisible" BOOLEAN NOT NULL DEFAULT true;
