import { Module } from "@nestjs/common";
import { WhatsappProviderModule } from "./whatsapp-provider.module";
import { MessagingModule } from "../messaging/messaging.module";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { WebhookController } from "./webhook.controller";
import { OrgWebhookController } from "./org-webhook.controller";
import { OrgWebhookResolver } from "./org-webhook.resolver";
import { DevController } from "./dev.controller";
import { ConnectionController } from "./connection.controller";
import { ConnectHubController } from "./connect-hub.controller";
import { InboundProcessor } from "./processors/inbound.processor";
import { OutboundProcessor } from "./processors/outbound.processor";

@Module({
  imports: [WhatsappProviderModule, MessagingModule, CampaignsModule],
  controllers: [
    WebhookController,
    OrgWebhookController,
    DevController,
    ConnectionController,
    ConnectHubController,
  ],
  providers: [InboundProcessor, OutboundProcessor, OrgWebhookResolver],
})
export class WhatsappModule {}
