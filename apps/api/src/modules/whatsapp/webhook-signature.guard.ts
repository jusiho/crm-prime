import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { IntegrationSettingsService } from "../integrations/integration-settings.service";

/**
 * Valida la firma X-Hub-Signature-256 de los webhooks de Meta.
 * El app secret sale de Ajustes › Integraciones (con respaldo en
 * WHATSAPP_APP_SECRET); si no hay ninguno, se omite con un aviso.
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger("WebhookSignature");

  constructor(private readonly settings: IntegrationSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const secret = (await this.settings.whatsappAppSecret()) ?? "";
    if (!secret) {
      this.logger.warn(
        "Sin app secret de WhatsApp: firma del webhook NO verificada (modo dev). Configúralo en Ajustes › Integraciones.",
      );
      return true;
    }

    const req = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();
    const header = req.headers["x-hub-signature-256"];
    const raw = req.rawBody;
    if (!header || typeof header !== "string" || !raw) {
      throw new UnauthorizedException("Firma ausente");
    }

    const expected =
      "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException("Firma inválida");
    }
    return true;
  }
}
