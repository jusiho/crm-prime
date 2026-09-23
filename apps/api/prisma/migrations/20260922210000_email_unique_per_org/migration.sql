-- El correo pasa a ser único por empresa, no en toda la instalación.
--
-- Sin esto, la misma persona no puede tener cuenta en dos empresas del SaaS, y
-- —peor— el primero que registre "ana@gmail.com" se lo quita a todos los demás.
--
-- Es el cambio que obliga a que el acceso sepa de qué empresa es ANTES de
-- buscar al usuario. De ahí sale la pantalla de acceso por subdominio: el
-- `Host` dice a quién buscar; la contraseña sigue diciendo si puede entrar.
DROP INDEX "users_email_key";
CREATE UNIQUE INDEX "users_orgId_email_key" ON "users"("orgId", "email");
