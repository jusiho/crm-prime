import { Module } from "@nestjs/common";
import { MediaController } from "./media.controller";
import { MessagingService } from "./messaging.service";
import { MessagingController } from "./messaging.controller";
import { WhatsappProviderModule } from "../whatsapp/whatsapp-provider.module";

@Module({
  imports: [WhatsappProviderModule],
  controllers: [MediaController, MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
