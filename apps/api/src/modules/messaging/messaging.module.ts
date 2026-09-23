import { Module } from "@nestjs/common";
import { MediaController } from "./media.controller";
import { MessagingService } from "./messaging.service";
import { MessagingController } from "./messaging.controller";
import { WhatsappProviderModule } from "../whatsapp/whatsapp-provider.module";
import { CampaignsModule } from "../campaigns/campaigns.module";

@Module({
  imports: [WhatsappProviderModule, CampaignsModule],
  controllers: [MediaController, MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
