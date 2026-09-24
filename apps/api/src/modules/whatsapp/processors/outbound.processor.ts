import { Logger } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE_OUTBOUND } from "../../../infra/queue/queue.constants";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { runUnscoped } from "../../../infra/tenant/tenant.context";
import { runJobInOrg } from "../../../infra/tenant/job-org";
import { MessagingService } from "../../messaging/messaging.service";

interface OutboundJob {
  messageId: string;
  /** Lo pone quien encola. Los trabajos anteriores al cambio no lo traen. */
  orgId?: string;
}

@Processor(QUEUE_OUTBOUND)
export class OutboundProcessor extends WorkerHost {
  private readonly logger = new Logger("OutboundProcessor");

  constructor(
    private readonly messaging: MessagingService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<OutboundJob>): Promise<void> {
    const orgId = await this.orgOf(job.data);
    await runJobInOrg("envío", orgId, () =>
      this.messaging.processOutbound(job.data.messageId),
    );
  }

  // Tras agotar los reintentos, marcar el mensaje como FAILED.
  @OnWorkerEvent("failed")
  async onFailed(job: Job<OutboundJob>, err: Error): Promise<void> {
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= attempts) {
      this.logger.error(
        `Envío ${job.data.messageId} falló definitivamente: ${err.message}`,
      );
      const orgId = await this.orgOf(job.data);
      await runJobInOrg("envío fallido", orgId, () =>
        this.messaging.markFailed(job.data.messageId, err.message),
      );
    }
  }

  /**
   * La empresa del trabajo: la que trae, o la del mensaje si es un trabajo
   * anterior al cambio (quedaban en Redis al desplegar). Esa segunda consulta
   * va sin filtrar por necesidad: es la que averigua el filtro.
   */
  private async orgOf(data: OutboundJob): Promise<string | null> {
    if (data.orgId) return data.orgId;
    const m = await runUnscoped("worker de envío: empresa del mensaje", () =>
      this.prisma.message.findUnique({
        where: { id: data.messageId },
        select: { orgId: true },
      }),
    );
    return m?.orgId ?? null;
  }
}
