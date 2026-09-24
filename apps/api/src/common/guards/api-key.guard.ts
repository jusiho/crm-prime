import { i18n } from "../../i18n/i18n";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { timingSafeEqual } from "node:crypto";
import type { ApiScope } from "@crm/shared";
import { SCOPES_KEY } from "../decorators/scopes.decorator";
import { env } from "../utils/env";
import { tenancyMode } from "../../infra/tenant/tenant.context";
import { hostDe, subdominioDe } from "../utils/subdomain";
import {
  ApiKeyService,
  type AuthenticatedApiKey,
} from "../../modules/api-keys/api-key.service";

/**
 * Autentica integraciones externas con una clave de API emitida por el CRM.
 *
 * Acepta la clave en `Authorization: Bearer crm_…` o en `x-api-key`. Por
 * compatibilidad sigue aceptando `x-webhook-token` con el LEAD_WEBHOOK_TOKEN
 * heredado del .env, para no romper las integraciones que ya estaban
 * funcionando; ese camino no tiene ámbitos ni deja rastro de quién llamó.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger("ApiKeyGuard");

  constructor(
    private readonly reflector: Reflector,
    private readonly keys: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const required =
      this.reflector.getAllAndOverride<ApiScope[] | undefined>(SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const presented = this.extract(req);
    if (!presented) {
      throw new UnauthorizedException(
        "Falta la clave de API (cabecera Authorization: Bearer crm_…)",
      );
    }

    // Clave emitida desde el dashboard: con ámbitos y trazabilidad.
    if (presented.startsWith("crm_")) {
      const key = await this.keys.verify(presented);
      if (!key) throw new UnauthorizedException("Clave de API inválida o revocada");

      const missing = required.filter((s) => !key.scopes.includes(s));
      if (missing.length) {
        throw new ForbiddenException(
          i18n("apiKey.missingScopes", {
            name: key.name,
            missing: missing.join(", "),
          }),
        );
      }
      // La API también se sirve bajo el subdominio de cada empresa
      // (acme.trimmo.lat/api/public/…), al estilo Kommo. Si la llamada entra
      // por la dirección de una empresa, la clave tiene que ser de ESA
      // empresa. No es lo que concede el acceso —eso ya lo hizo la clave—,
      // es lo que impide usar una clave de Acme contra la dirección de Globex
      // por error o por prueba.
      const slug = subdominioDe(hostDe(req.headers));
      if (slug && slug !== key.orgSlug) {
        throw new ForbiddenException(
          "Esta clave no pertenece a la empresa de esta dirección",
        );
      }

      req.apiKey = key satisfies AuthenticatedApiKey;
      return true;
    }

    // Camino heredado: token único del .env. Solo con una empresa: en SaaS ese
    // token no pertenece a nadie, y una clave sin empresa no puede leer ni
    // escribir nada. Cada cliente crea las suyas en Ajustes › Claves de API.
    const legacy = tenancyMode === "multi" ? undefined : env("LEAD_WEBHOOK_TOKEN");
    if (legacy && this.sameSecret(presented, legacy)) {
      this.logger.warn(
        "Petición autenticada con LEAD_WEBHOOK_TOKEN (heredado). Crea una clave por integración en Ajustes › Claves de API.",
      );
      req.apiKey = null;
      return true;
    }

    throw new UnauthorizedException("Clave de API inválida o revocada");
  }

  private extract(req: {
    headers: Record<string, string | string[] | undefined>;
  }): string | null {
    const header = (name: string): string | null => {
      const v = req.headers[name];
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };

    const auth = header("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
    return header("x-api-key") ?? header("x-webhook-token");
  }

  private sameSecret(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  }
}
