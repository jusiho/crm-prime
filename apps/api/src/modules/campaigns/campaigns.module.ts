import { Module } from "@nestjs/common";
import { TemplateService } from "./template.service";
import { MetaTemplateClient } from "./meta-template.client";
import { TemplateFillService } from "./template-fill.service";
import { CampaignService } from "./campaign.service";
import { CampaignProcessor } from "./campaign.processor";
import { CampaignsController } from "./campaigns.controller";
import { WhatsappProviderModule } from "../whatsapp/whatsapp-provider.module";

@Module({
  imports: [WhatsappProviderModule],
  controllers: [CampaignsController],
  providers: [
    TemplateService,
    MetaTemplateClient,
    TemplateFillService,
    CampaignService,
    CampaignProcessor,
  ],
  exports: [TemplateService, TemplateFillService],
})
export class CampaignsModule {}
