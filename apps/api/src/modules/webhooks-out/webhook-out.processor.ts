import { Logger } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE_WEBHOOK } from "../../infra/queue/queue.constants";
import { WebhookOutService, type WebhookJob } from "./webhook-out.service";

/**
 * Entrega los webhooks salientes con reintentos. Que falle un destino no
 * afecta a los demás: cada suscripción tiene su propio job.
 */
@Processor(QUEUE_WEBHOOK)
export class WebhookOutProcessor extends WorkerHost {
  private readonly logger = new Logger("WebhooksOut");

  constructor(private readonly webhooks: WebhookOutService) {
    super();
  }

  async process(job: Job<WebhookJob>): Promise<void> {
    const sub = await this.webhooks.findSubscription(job.data.subscriptionId);
    // Borrada o desactivada mientras el job esperaba: se descarta sin ruido.
    if (!sub || !sub.isActive) return;

    const res = await this.webhooks.deliver(sub, job.data);
    if (!res.ok) {
      // Lanzar hace que BullMQ reintente con la espera configurada.
      throw new Error(`El destino respondió ${res.status}`);
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<WebhookJob>, err: Error): Promise<void> {
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= attempts) {
      this.logger.error(
        `Webhook ${job.data.event} → ${job.data.subscriptionId} falló definitivamente: ${err.message}`,
      );
      await this.webhooks.recordFailure(job.data.subscriptionId, err.message);
    }
  }
}
