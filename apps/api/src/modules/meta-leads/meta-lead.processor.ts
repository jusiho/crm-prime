import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE_META_LEADS } from "../../infra/queue/queue.constants";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { runUnscoped } from "../../infra/tenant/tenant.context";
import { runJobInOrg } from "../../infra/tenant/job-org";
import { MetaLeadService, type LeadgenNotification } from "./meta-lead.service";

@Processor(QUEUE_META_LEADS)
export class MetaLeadProcessor extends WorkerHost {
  private readonly logger = new Logger("MetaLeadProcessor");

  constructor(
    private readonly leads: MetaLeadService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<LeadgenNotification>): Promise<void> {
    // El aviso viene de Meta y no sabe nada de nuestras empresas. Lo único
    // que trae es el id de la página, y una página pertenece a una sola
    // empresa (pageId es único global): de ahí sale el contexto. Esta consulta
    // va sin filtrar por necesidad — es la que produce el filtro.
    const page = await runUnscoped("worker de leads: empresa de la página", () =>
      this.prisma.metaPage.findUnique({
        where: { pageId: job.data.pageId },
        select: { orgId: true },
      }),
    );
    if (!page) {
      // Página desconectada mientras el aviso esperaba: no hay a quién
      // entregarle el lead. Se descarta con rastro, no con reintentos.
      this.logger.warn(`Lead ${job.data.leadgenId}: la página ${job.data.pageId} ya no está conectada`);
      return;
    }
    await runJobInOrg("lead de Meta", page.orgId, () =>
      this.leads.processNotification(job.data),
    );
  }
}
