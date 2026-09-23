import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "./env";

/**
 * Cifrado simétrico para secretos que viven en la BD (API keys de IA).
 *
 * AES-256-GCM. La clave se deriva de APP_ENCRYPTION_KEY (o, en su defecto,
 * de JWT_ACCESS_SECRET para no exigir una variable nueva en instalaciones
 * existentes). Formato del texto cifrado: "v1:<iv>:<tag>:<datos>" en base64url.
 *
 * Aviso: si cambias el secreto de origen, las keys guardadas dejan de poder
 * descifrarse y hay que volver a introducirlas desde Ajustes.
 */

const PREFIX = "v1";
// NO TOCAR aunque el producto cambie de nombre.
//
// Esta cadena entra en la derivación de la clave (HKDF). Si cambia, la clave
// que sale es otra y TODO lo cifrado con la anterior —tokens de WhatsApp,
// claves de OpenAI y Anthropic— deja de poder descifrarse, en silencio y sin
// error hasta que alguien intente usarlo.
//
// Sobrevive al renombrado a Trimmo por eso, no por descuido.
const SALT = "crm-prime.ai-secrets";

function masterKey(): Buffer {
  // env() trata APP_ENCRYPTION_KEY="" como ausente y cae a JWT_ACCESS_SECRET.
  const source = env("APP_ENCRYPTION_KEY") ?? env("JWT_ACCESS_SECRET");
  if (!source) {
    throw new Error(
      "Falta APP_ENCRYPTION_KEY (o JWT_ACCESS_SECRET) para cifrar las credenciales de IA",
    );
  }
  return scryptSync(source, SALT, 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    data.toString("base64url"),
  ].join(":");
}

// Devuelve null si el texto está corrupto o se cifró con otro secreto, para
// que el llamador pueda caer al valor del entorno en lugar de reventar.
export function decryptSecret(payload: string): string | null {
  try {
    const [version, iv, tag, data] = payload.split(":");
    if (version !== PREFIX || !iv || !tag || !data) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      masterKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

// "sk-proj-abc…9f2a" — suficiente para reconocer la key sin exponerla.
export function maskSecret(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "•".repeat(trimmed.length);
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}
