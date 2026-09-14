/**
 * Lee una variable de entorno tratando la cadena vacía como "no definida".
 *
 * Importa porque `.env.example` declara varias claves opcionales como `FOO=""`
 * y, al copiarlas, `process.env.FOO` vale `""`: con `??` eso NO cae al valor
 * por defecto (solo null/undefined lo hacen) y se propaga una URL o un secreto
 * vacío. Con este helper, `FOO=""` equivale a no tener la variable.
 */
export function env(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}
