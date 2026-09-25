-- Contador de mensajes sin leer por conversación (se incrementa con cada
-- mensaje del contacto y se pone a cero al abrir el chat).
ALTER TABLE "conversations" ADD COLUMN "unreadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "conversations" ADD COLUMN "lastReadAt" TIMESTAMP(3);
