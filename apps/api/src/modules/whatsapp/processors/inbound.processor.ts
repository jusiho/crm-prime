import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE_INBOUND } from "../../../infra/queue/queue.constants";
import { MessagingService } from "../../messaging/messaging.service";
import { TemplateService } from "../../campaigns/template.service";
import {
  WHATSAPP_PROVIDER,
  type WhatsAppProvider,
} from "../whatsapp-provider.interface";
import type { InboundJob } from "../webhook.types";

@Processor(QUEUE_INBOUND)
export class InboundProcessor extends WorkerHost {
  private readonly logger = new Logger("InboundProcessor");

  constructor(
    private readonly messaging: MessagingService,
    private readonly templates: TemplateService,
    @Inject(WHATSAPP_PROVIDER) private readonly wa: WhatsAppProvider,
  ) {
    super();
  }

  async process(job: Job<InboundJob>): Promise<void> {
    const data = job.data;

    if (data.kind === "status") {
      await this.messaging.handleStatus(data.waMessageId, data.status);
      return;
    }

    // Coexistencia: mensaje enviado desde la app del celular.
    if (data.kind === "echo") {
      await this.messaging.handleEcho({
        to: data.to,
        waMessageId: data.waMessageId,
        type: data.type,
        text: data.text,
        channelPhoneNumberId: data.channelPhoneNumberId,
      });
      return;
    }

    if (data.kind === "reaction") {
      await this.messaging.handleReaction(data.targetWaMessageId, data.emoji);
      return;
    }

    if (data.kind === "history") {
      await this.messaging.handleHistory({
        customerWaId: data.customerWaId,
        fromCustomer: data.fromCustomer,
        waMessageId: data.waMessageId,
        type: data.type,
        text: data.text,
        timestampMs: data.timestampMs,
        channelPhoneNumberId: data.channelPhoneNumberId,
      });
      return;
    }

    if (data.kind === "state_sync") {
      await this.messaging.handleStateSync(data.items);
      return;
    }

    // Meta revisó una plantilla: aprobada, rechazada, pausada…
    if (data.kind === "template_status") {
      await this.templates.applyStatusUpdate(data);
      return;
    }

    // Mensaje entrante: si trae medio, descargarlo antes de persistir.
    let mediaUrl: string | undefined;
    if (data.mediaId) {
      const media = await this.wa.downloadMedia(
        data.mediaId,
        data.channelPhoneNumberId,
      );
      mediaUrl = media.url;
    }

    await this.messaging.handleInbound({
      from: data.from,
      name: data.name,
      waMessageId: data.waMessageId,
      type: data.type,
      text: data.text,
      mediaUrl,
      channelPhoneNumberId: data.channelPhoneNumberId,
      // Anuncio Click-to-WhatsApp que originó la conversación.
      referral: data.referral,
      replyToWaMessageId: data.replyToWaMessageId,
      buttonPayload: data.buttonPayload,
    });
  }
}
