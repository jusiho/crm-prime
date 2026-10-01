import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE_AI_REPLY } from "../../infra/queue/queue.constants";
import { runJobInOrg } from "../../infra/tenant/job-org";
import { AutopilotService } from "./autopilot.service";

export interface AiReplyJob {
  conversationId: string;
  orgId: string;
  /** El mensaje entrante que pidió este turno: solo responde si sigue siendo el último. */
  messageId: string;
}

/**
 * Turno de respuesta del autopilot, retrasado unos segundos: si el cliente
 * escribe en varios mensajes seguidos, cada uno encola su turno y solo el del
 * último mensaje llega a correr. Así la IA responde una vez, a todo junto.
 */
@Processor(QUEUE_AI_REPLY)
export class AiReplyProcessor extends WorkerHost {
  constructor(private readonly autopilot: AutopilotService) {
    super();
  }

  async process(job: Job<AiReplyJob>): Promise<void> {
    await runJobInOrg("respuesta de la IA", job.data.orgId, () =>
      this.autopilot.runIfLatest(job.data.conversationId, job.data.messageId),
    );
  }
}
