-- Lo que la IA entendió de un audio (transcripción), una imagen o un sticker
-- (descripción). Null = aún no procesado; "" = no se pudo (sin clave, formato).
ALTER TABLE "messages" ADD COLUMN "transcript" TEXT;
