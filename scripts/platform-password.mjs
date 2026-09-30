#!/usr/bin/env node
/**
 * Genera la contraseña de la cuenta maestra de la plataforma (admin.<dominio>).
 *
 *   npm run platform:password -- "tu-contraseña-larga"
 *
 * Imprime la línea para .env.production. El hash va en base64 porque un
 * bcrypt lleva `$` y Docker Compose lo interpretaría como variable.
 */
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Uso: npm run platform:password -- "contraseña de al menos 12 caracteres"');
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
console.log("\nAñade estas dos líneas a .env.production y reinicia la API:\n");
console.log('PLATFORM_ADMIN_EMAIL="tu@correo.com"');
console.log(`PLATFORM_ADMIN_PASSWORD_HASH="${Buffer.from(hash).toString("base64")}"\n`);
