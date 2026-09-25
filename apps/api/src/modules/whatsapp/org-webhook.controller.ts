import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import type { Request } from "express";
import { QUEUE_INBOUND } from "../../infra/queue/queue.constants";
import { IntegrationSettingsService } from "../integrations/integration-settings.service";
import {
  OrgWebhookSignatureGuard,
  type OrgWebhookRequest,
} from "./org-webhook-signature.guard";
import { OrgWebhookResolver } from "./org-webhook.resolver";
import { normalizeWebhook, type MetaWebhookBody } from "./webhook.types";

/**
 * Webhook de WhatsApp para la **app de Meta propia** de una empresa:
 * `acme.trimmo.lat/api/v1/webhooks/whatsapp`.
 *
 * Existe porque el Embedded Signup solo incorpora clientes cuando Meta ha
 * dado a la plataforma acceso avanzado a los permisos de WhatsApp. Mientras
 * tanto —o si lo prefiere— un cliente puede usar su propia app: guarda su App
 * secret y verify token en Ajustes › Integraciones, apunta el webhook de su
 * app aquí y añade el número a mano con su token. El webhook de la app de la
 * plataforma sigue en `whatsapp/webhook`.
 *
 * El subdominio dice de qué empresa es la ruta; la firma con SU secreto es lo
 * que autentica; y el worker exige además que el número del evento sea suyo
 * (`InboundOrigin`), para que una app ajena no pueda meter mensajes en otra
 * empresa aunque firme bien lo suyo.
 */
@Controller("webhooks/whatsapp")
export class OrgWebhookController {
  private readonly logger = new Logger("WebhookPropio");

  constructor(
    @InjectQueue(QUEUE_INBOUND) private readonly inbound: Queue,
    private readonly settings: IntegrationSettingsService,
    private readonly resolver: OrgWebhookResolver,
  ) {}

  // Verificación: Meta hace GET una sola vez al dar de alta el webhook.
  @Get()
  async verify(
    @Req() req: Request,
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ): Promise<string> {
    const org = await this.resolver.porHost(req);
    const propia = await this.settings.ownWhatsappApp(org.id);
    if (mode === "subscribe" && !!propia?.verifyToken && token === propia.verifyToken) {
      this.logger.log(`Webhook propio verificado (${org.slug})`);
      return challenge;
    }
    throw new ForbiddenException("verify_token inválido");
  }

  // Eventos. 200 inmediato; el trabajo va a la cola, atado a la empresa.
  @Post()
  @HttpCode(200)
  @UseGuards(OrgWebhookSignatureGuard)
  async receive(
    @Req() req: OrgWebhookRequest,
    @Body() body: MetaWebhookBody,
  ): Promise<{ received: true }> {
    const { orgId } = req.orgWebhook;
    const jobs = normalizeWebhook(body);
    if (jobs.length) {
      await this.inbound.addBulk(
        jobs.map((data) => ({ name: data.kind, data: { ...data, orgId } })),
      );
    }
    return { received: true };
  }
}
