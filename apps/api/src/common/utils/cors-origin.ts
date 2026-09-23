import { env } from "./env";

/**
 * Qué orígenes pueden llamar a la API desde un navegador.
 *
 * Con una sola empresa bastaba una lista fija en `WEB_ORIGIN`. Con subdominios
 * por empresa no: cada alta crearía un origen nuevo (`acme.trimmo.lat`,
 * `globex.trimmo.lat`…) y habría que redesplegar para que el navegador de ese
 * cliente pudiera hablar con la API. Sería un alta que no termina hasta que
 * alguien toca el servidor.
 *
 * Por eso se acepta **cualquier subdominio de primer nivel** del dominio base,
 * que es exactamente lo que cubre el certificado comodín. Ni más ni menos:
 * `acme.trimmo.lat` sí, `algo.acme.trimmo.lat` no, `trimmo.lat.otrositio.com`
 * tampoco — y ese último es el que importa, porque es el que intentaría alguien
 * que quisiera colarse comprobando el final de la cadena a lo bruto.
 */
export function isAllowedOrigin(origin?: string | null): boolean {
  // Sin cabecera Origin: peticiones que no vienen de un navegador — el webhook
  // de Meta, curl, servidor a servidor. CORS no aplica ahí.
  if (!origin) return true;

  const explicitos = (env("WEB_ORIGIN") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (explicitos.includes(origin)) return true;

  const base = env("SAAS_BASE_DOMAIN");
  if (!base) {
    // Ni lista ni dominio base: desarrollo. Se mantiene el comportamiento de
    // antes (abierto) para no romper instalaciones que no configuran nada.
    return explicitos.length === 0;
  }

  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }

  const dominio = (base.split(":")[0] ?? "").toLowerCase();
  if (!dominio) return false;
  if (host === dominio) return true;
  if (!host.endsWith(`.${dominio}`)) return false;

  const sub = host.slice(0, -(dominio.length + 1));
  return sub.length > 0 && !sub.includes(".");
}

/** Valor de `origin` para `enableCors` y para el gateway de socket.io. */
export function corsOrigin() {
  return (
    origin: string | undefined,
    cb: (err: Error | null, allow?: boolean) => void,
  ) => cb(null, isAllowedOrigin(origin));
}
