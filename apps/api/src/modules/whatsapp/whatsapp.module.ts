import { Module } from "@nestjs/common";
import { WhatsappProviderModule } from "./whatsapp-provider.module";
import { MessagingModule } from "../messaging/messaging.module";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { WebhookController } from "./webhook.controller";
import { DevController } from "./dev.controller";
import { ConnectionController } from "./connection.controller";
import { ConnectHubController } from "./connect-hub.controller";
import { InboundProcessor } from "./processors/inbound.processor";
import { OutboundProcessor } from "./processors/outbound.processor";

@Module({
  imports: [WhatsappProviderModule, MessagingModule, CampaignsModule],
  controllers: [
    WebhookController,
    DevController,
    ConnectionController,
    ConnectHubController,
  ],
  providers: [InboundProcessor, OutboundProcessor],
})
export class WhatsappModule {}
