import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  MessageAuthor,
  MessageDirection,
  MessageStatus,
  MessageType,
  type VariableValue,
} from "@crm/shared";
import { QUEUE_CAMPAIGN } from "../../infra/queue/queue.constants";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TenantService } from "../../infra/tenant/tenant.service";
import {
  WHATSAPP_PROVIDER,
  type WhatsAppProvider,
} from "../whatsapp/whatsapp-provider.interface";
import { CampaignService } from "./campaign.service";

type CampaignJob =
  | { kind: "launch"; campaignId: string }
  | { kind: "send"; campaignId: string; contactId: string };

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Throttling: como máximo 10 envíos por segundo (respeta rate limits de Meta).
@Processor(QUEUE_CAMPAIGN, {
  concurrency: 5,
  limiter: { max: 10, duration: 1000 },
})
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger("CampaignProcessor");

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly campaigns: CampaignService,
    @Inject(WHATSAPP_PROVIDER) private readonly wa: WhatsAppProvider,
  ) {
    super();
  }

  async process(job: Job<CampaignJob>): Promise<void> {
    if (job.data.kind === "launch") {
      await this.campaigns.fanOut(job.data.campaignId);
      return;
    }
    await this.sendOne(job.data.campaignId, job.data.contactId);
  }

  private async sendOne(campaignId: string, contactId: string): Promise<void> {
    const [campaign, contact] = await Promise.all([
      this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { template: true, channel: true },
      }),
      this.prisma.contact.findUnique({ where: { id: contactId } }),
    ]);
    if (!campaign || !contact) return;
    if (campaign.status === "CANCELLED") return;
    if (!contact.optIn) return; // respeta opt-out

    const variables = this.resolveVariables(
      (campaign.variableValues as VariableValue[] | null) ?? [],
      contact,
    );
    const preview = this.render(campaign.template.body, variables);
    // Esto corre en un worker, sin petición HTTP detrás: la organización sale
    // del propio contacto, no del contexto.
    const orgId = contact.orgId;
    const conversationId = await this.ensureConversation(
      orgId,
      contactId,
      campaign.channelId,
    );

    const message = await this.prisma.message.create({
      data: {
        orgId,
        conversationId,
        campaignId,
        templateId: campaign.templateId,
        direction: MessageDirection.OUTBOUND,
        type: MessageType.TEMPLATE,
        author: MessageAuthor.HUMAN,
        content: preview,
        status: MessageStatus.QUEUED,
      },
    });

    try {
      const res = await this.wa.sendTemplate(
        contact.phone,
        campaign.template.name,
        campaign.template.language,
        variables,
        campaign.channel?.phoneNumberId,
      );
      await this.prisma.message.update({
        where: { id: message.id },
        data: { waMessageId: res.waMessageId, status: MessageStatus.SENT },
      });
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { sentCount: { increment: 1 } },
      });
    } catch (e) {
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.FAILED,
          errorReason: (e as Error).message.slice(0, 500),
        },
      });
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { failedCount: { increment: 1 } },
      });
      this.logger.warn(
        `Envío de campaña falló a ${contact.phone}: ${(e as Error).message}`,
      );
    }

    await this.campaigns.checkCompletion(campaignId);
  }

  // Variables posicionales según el mapeo de la campaña.
  private resolveVariables(
    values: VariableValue[],
    contact: { name: string | null; phone: string },
  ): string[] {
    return [...values]
      .sort((a, b) => a.index - b.index)
      .map((v) => {
        if (v.source === "contact_name") return contact.name ?? "";
        if (v.source === "contact_phone") return contact.phone;
        return v.value ?? "";
      });
  }

  private render(body: string, vars: string[]): string {
    return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n: string) => {
      const idx = Number(n) - 1;
      return vars[idx] ?? "";
    });
  }

  // Reusa la conversación abierta del contacto o crea una nueva.
  private async ensureConversation(
    orgId: string,
    contactId: string,
    channelId: string | null,
  ): Promise<string> {
    const open = await this.prisma.conversation.findFirst({
      where: { contactId, status: { not: "CLOSED" } },
      orderBy: { createdAt: "desc" },
    });
    if (open) return open.id;
    const created = await this.prisma.conversation.create({
      data: {
        orgId,
        contactId,
        channelId,
        status: "OPEN",
        windowExpiresAt: new Date(Date.now() + WINDOW_MS),
        lastMessageAt: new Date(),
      },
    });
    return created.id;
  }
}
