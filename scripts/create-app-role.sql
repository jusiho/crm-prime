-- Rol con el que la aplicación se conecta en producción multi-empresa.
--
-- ── La trampa ────────────────────────────────────────────────
-- En Postgres, el DUEÑO de una tabla se salta las políticas RLS. Si la
-- aplicación se conecta con el mismo usuario que corrió las migraciones, las
-- políticas existen, se ven en el catálogo, y **no protegen nada**. Es un fallo
-- silencioso: todo funciona y no aísla.
--
-- Por eso hacen falta dos roles:
--   crm      → dueño de las tablas. Corre migraciones y seed. Se salta RLS.
--   crm_app  → el de la aplicación. No posee nada, no tiene BYPASSRLS.
--
-- ── Uso ──────────────────────────────────────────────────────
--   psql "$DATABASE_URL" -v pass=una-clave-larga -f scripts/create-app-role.sql
--
-- La contraseña va SIN comillas: `:'pass'` ya las pone. Si las escribes tú,
-- acaban formando parte de la contraseña y la autenticación falla con un
-- mensaje que no lo explica.
--
-- Después, el DATABASE_URL de la aplicación apunta a crm_app, y el de las
-- migraciones (DIRECT_DATABASE_URL o el despliegue) sigue apuntando a crm.

\set ON_ERROR_STOP on

-- `\gexec` ejecuta como SQL cada fila que devuelve la consulta. Se usa porque
-- psql NO interpola sus variables (:'pass') dentro de un bloque $$…$$, así que
-- un DO clásico aquí falla con un error de sintaxis desconcertante.
SELECT format('CREATE ROLE crm_app LOGIN PASSWORD %L', :'pass')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_app')
\gexec

SELECT format('ALTER ROLE crm_app PASSWORD %L', :'pass')
\gexec

-- Sin privilegios de más: nada de SUPERUSER, CREATEDB ni BYPASSRLS.
ALTER ROLE crm_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT LOGIN;

-- El nombre de la base no se escribe a mano: así el script vale igual para
-- producción, para staging y para la base de los tests.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO crm_app', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO crm_app;

-- Datos sí; estructura no. crm_app no puede alterar tablas ni, sobre todo,
-- desactivar las políticas que lo limitan.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO crm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app;

-- Que las tablas futuras (migraciones nuevas) hereden lo mismo sin acordarse.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO crm_app;

-- Comprobación: si esto no sale vacío, el rol tiene permisos que no debería.
SELECT rolname, rolsuper, rolbypassrls, rolcreatedb
  FROM pg_roles
 WHERE rolname = 'crm_app'
   AND (rolsuper OR rolbypassrls OR rolcreatedb);
