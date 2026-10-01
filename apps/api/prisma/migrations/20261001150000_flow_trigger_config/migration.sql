-- Configuración del disparador de un flujo (etiquetas, etapas, formularios,
-- horas sin respuesta…). Los flujos existentes siguen igual: {} = sin filtro.
ALTER TABLE "flows" ADD COLUMN "triggerConfig" JSONB NOT NULL DEFAULT '{}';
