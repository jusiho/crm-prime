-- Segundos que el autopilot espera desde el último mensaje del cliente antes
-- de responder: si escribe en varias partes, se le contesta una sola vez.
ALTER TABLE "agent_configs" ADD COLUMN "replyDelaySec" INTEGER NOT NULL DEFAULT 4;
