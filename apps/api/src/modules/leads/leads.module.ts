import { Module } from "@nestjs/common";
import { LeadService } from "./lead.service";
import { CustomFieldsController } from "./custom-fields.controller";
import { LeadWebhookController } from "./lead-webhook.controller";

@Module({
  controllers: [CustomFieldsController, LeadWebhookController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadsModule {}
