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
          `La clave "${key.name}" no tiene permiso para esto (falta: ${missing.join(", ")})`,
        );
      }
      req.apiKey = key satisfies AuthenticatedApiKey;
      return true;
    }

    // Camino heredado: token único del .env.
    const legacy = env("LEAD_WEBHOOK_TOKEN");
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
