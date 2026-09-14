import { Global, Module } from "@nestjs/common";
import { WebhookOutService } from "./webhook-out.service";
import { WebhookOutProcessor } from "./webhook-out.processor";
import { WebhooksOutController } from "./webhooks-out.controller";

// Global: cualquier módulo que provoque un hecho relevante puede emitirlo.
@Global()
@Module({
  controllers: [WebhooksOutController],
  providers: [WebhookOutService, WebhookOutProcessor],
  exports: [WebhookOutService],
})
export class WebhooksOutModule {}
