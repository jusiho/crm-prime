import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { IntegrationSettingsService } from "../integrations/integration-settings.service";
import { OrgWebhookResolver } from "./org-webhook.resolver";

export interface OrgWebhookRequest extends Request {
  rawBody?: Buffer;
  /** Lo deja el guard para el controlador: de quién es esta ruta. */
  orgWebhook: { orgId: string; slug: string };
}

/**
 * Firma X-Hub-Signature-256 de un webhook que llega por la ruta de una
 * empresa, calculada con el app secret de **su propia app de Meta**.
 *
 * A diferencia del guard de la plataforma, aquí no hay "modo dev" sin
 * secreto: la ruta es pública y cualquiera puede llamarla con el subdominio de
 * otro. Sin secreto guardado, no entra nada.
 */
@Injectable()
export class OrgWebhookSignatureGuard implements CanActivate {
  constructor(
    private readonly settings: IntegrationSettingsService,
    private readonly resolver: OrgWebhookResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<OrgWebhookRequest>();
    const org = await this.resolver.porHost(req);
    const propia = await this.settings.ownWhatsappApp(org.id);
    if (!propia?.appSecret) {
      throw new UnauthorizedException("Esta empresa no tiene configurada su propia app de Meta");
    }

    const header = req.headers["x-hub-signature-256"];
    const raw = req.rawBody;
    if (!header || typeof header !== "string" || !raw) {
      throw new UnauthorizedException("Firma ausente");
    }
    const expected =
      "sha256=" + createHmac("sha256", propia.appSecret).update(raw).digest("hex");
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException("Firma inválida");
    }

    req.orgWebhook = { orgId: org.id, slug: org.slug };
    return true;
  }
}
