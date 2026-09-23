import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUEUE_META_LEADS } from "../../infra/queue/queue.constants";
import { MetaLeadService, type LeadgenNotification } from "./meta-lead.service";

@Processor(QUEUE_META_LEADS)
export class MetaLeadProcessor extends WorkerHost {
  private readonly logger = new Logger("MetaLeadProcessor");

  constructor(private readonly leads: MetaLeadService) {
    super();
  }

  async process(job: Job<LeadgenNotification>): Promise<void> {
    await this.leads.processNotification(job.data);
  }
}
