import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE_FLOW } from "../../infra/queue/queue.constants";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { runUnscoped } from "../../infra/tenant/tenant.context";
import { runJobInOrg } from "../../infra/tenant/job-org";
import { FlowEngineService } from "./flow-engine.service";

interface FlowResumeJob {
  conversationId: string;
  /** Lo pone quien encola. Los trabajos anteriores al cambio no lo traen. */
  orgId?: string;
}

@Processor(QUEUE_FLOW)
export class FlowProcessor extends WorkerHost {
  constructor(
    private readonly engine: FlowEngineService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<FlowResumeJob>): Promise<void> {
    const orgId =
      job.data.orgId ??
      // Trabajo anterior al cambio: la empresa se deduce de la conversación.
      // Consulta sin filtrar por necesidad: es la que produce el filtro.
      (
        await runUnscoped("worker de flujos: empresa de la conversación", () =>
          this.prisma.conversation.findUnique({
            where: { id: job.data.conversationId },
            select: { orgId: true },
          }),
        )
      )?.orgId;

    await runJobInOrg("flujo", orgId, () =>
      this.engine.resumeTimer(job.data.conversationId),
    );
  }
}
