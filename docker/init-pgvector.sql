-- Se ejecuta una sola vez, al crear el volumen de Postgres.
-- Así la extensión existe desde el primer arranque y `npm run setup` no
-- depende de que alguien recuerde el paso manual.
CREATE EXTENSION IF NOT EXISTS vector;
