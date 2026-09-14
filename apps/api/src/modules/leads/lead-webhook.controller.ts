import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { leadWebhookSchema, type LeadWebhookInput } from "@crm/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ApiKeyGuard } from "../../common/guards/api-key.guard";
import { Scopes } from "../../common/decorators/scopes.decorator";
import type { AuthenticatedApiKey } from "../api-keys/api-key.service";
import { LeadService } from "./lead.service";

/**
 * Webhook público para recibir leads de sistemas externos (landing pages,
 * anuncios, n8n, Zapier…). Se autentica con una clave de API creada en
 * Ajustes › Claves de API (`Authorization: Bearer crm_…`).
 */
@Controller("webhooks/lead")
export class LeadWebhookController {
  constructor(private readonly leads: LeadService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(ApiKeyGuard)
  @Scopes("leads:write")
  ingest(
    @Body(new ZodValidationPipe(leadWebhookSchema)) body: LeadWebhookInput,
    @Req() req: { apiKey?: AuthenticatedApiKey | null },
  ) {
    // El nombre de la clave manda sobre el campo `integration` del cuerpo:
    // aquel lo verifica el servidor, este lo declara quien llama.
    return this.leads.ingestLead(body, req.apiKey?.name ?? null);
  }
}
