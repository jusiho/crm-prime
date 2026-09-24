import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import type { Prisma } from "@prisma/client";
import type {
  AudienceTag,
  CampaignDto,
  CampaignMeta,
  CampaignStatusValue,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { currentOrgId } from "../../infra/tenant/tenant.context";
import { QUEUE_CAMPAIGN } from "../../infra/queue/queue.constants";
import { normalizeFill } from "./template-fill.service";
import { TemplateService } from "./template.service";

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplateService,
    @InjectQueue(QUEUE_CAMPAIGN) private readonly queue: Queue,
  ) {}

  // ── Lectura ──────────────────────────────────────────────────
  async list(): Promise<CampaignDto[]> {
    const rows = await this.prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { template: true, channel: true, tags: true },
    });
    return rows.map((c) => this.toDto(c));
  }

  async getById(id: string): Promise<CampaignDto> {
    const c = await this.prisma.campaign.findUnique({
      where: { id },
      include: { template: true, channel: true, tags: true },
    });
    if (!c) throw new NotFoundException("Difusión no encontrada");
    return this.toDto(c);
  }

  // Datos para el asistente: plantillas + etiquetas (con conteo) + canales.
  async meta(): Promise<CampaignMeta> {
    const [templates, tags, channels] = await Promise.all([
      this.templates.list(),
      this.prisma.tag.findMany({ orderBy: { name: "asc" } }),
      this.prisma.whatsappConnection.findMany({
        where: { isActive: true },
        orderBy: { connectedAt: "desc" },
      }),
    ]);
    const audienceTags: AudienceTag[] = await Promise.all(
      tags.map(async (t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        contactCount: await this.prisma.contact.count({
          where: { optIn: true, tags: { some: { tagId: t.id } } },
        }),
      })),
    );
    return {
      templates,
      tags: audienceTags,
      channels: channels.map((c) => ({
        id: c.id,
        label: c.label,
        displayPhoneNumber: c.displayPhoneNumber,
      })),
    };
  }

  // Cuántos contactos (opt-in) recibirían el envío con estas etiquetas.
  async audiencePreview(tagIds: string[]): Promise<{ count: number }> {
    return { count: await this.prisma.contact.count({ where: this.audienceWhere(tagIds) }) };
  }

  // ── Escritura ────────────────────────────────────────────────
  async create(input: CreateCampaignInput): Promise<CampaignDto> {
    const template = await this.prisma.template.findUnique({
      where: { id: input.templateId },
    });
    if (!template) throw new BadRequestException("Plantilla no encontrada");

    const c = await this.prisma.campaign.create({
      data: {
        name: input.name,
        templateId: input.templateId,
        channelId: input.channelId,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        variableValues: input.fill as unknown as Prisma.InputJsonValue,
        status: "DRAFT",
        tags: {
          create: input.tagIds.map((tagId) => ({ tagId })),
        },
      },
      include: { template: true, channel: true, tags: true },
    });
    return this.toDto(c);
  }

  async update(id: string, input: UpdateCampaignInput): Promise<CampaignDto> {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Difusión no encontrada");
    if (existing.status !== "DRAFT" && existing.status !== "SCHEDULED") {
      throw new BadRequestException(
        "Solo se pueden editar difusiones en borrador o programadas.",
      );
    }

    const c = await this.prisma.campaign.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.templateId !== undefined
          ? { templateId: input.templateId }
          : {}),
        ...(input.channelId !== undefined ? { channelId: input.channelId } : {}),
        ...(input.scheduledAt !== undefined
          ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }
          : {}),
        ...(input.fill !== undefined
          ? { variableValues: input.fill as unknown as Prisma.InputJsonValue }
          : {}),
        ...(input.tagIds !== undefined
          ? {
              tags: {
                deleteMany: {},
                create: input.tagIds.map((tagId) => ({ tagId })),
              },
            }
          : {}),
      },
      include: { template: true, channel: true, tags: true },
    });
    return this.toDto(c);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Difusión no encontrada");
    if (c.status === "RUNNING") {
      throw new BadRequestException("No puedes eliminar una difusión en curso.");
    }
    await this.prisma.campaign.delete({ where: { id } });
    return { ok: true };
  }

  // ── Lanzamiento ──────────────────────────────────────────────
  async launch(id: string): Promise<CampaignDto> {
    const c = await this.prisma.campaign.findUnique({
      where: { id },
      include: { tags: true },
    });
    if (!c) throw new NotFoundException("Difusión no encontrada");
    if (c.status === "RUNNING") {
      throw new BadRequestException("La difusión ya está en curso.");
    }

    // Programada a futuro: encolar un job retrasado que dispara el fan-out.
    if (c.scheduledAt && c.scheduledAt.getTime() > Date.now()) {
      await this.prisma.campaign.update({
        where: { id },
        data: { status: "SCHEDULED" },
      });
      await this.queue.add(
        "launch",
        { kind: "launch", campaignId: id, orgId: currentOrgId() ?? undefined },
        { delay: c.scheduledAt.getTime() - Date.now() },
      );
      return this.getById(id);
    }

    await this.fanOut(id);
    return this.getById(id);
  }

  // Calcula la audiencia y encola un job de envío por destinatario.
  async fanOut(campaignId: string): Promise<void> {
    const c = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { tags: true },
    });
    if (!c) return;

    const tagIds = c.tags.map((t) => t.tagId);
    const contacts = await this.prisma.contact.findMany({
      where: this.audienceWhere(tagIds),
      select: { id: true },
    });

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        totalRecipients: contacts.length,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        failedCount: 0,
      },
    });

    if (contacts.length === 0) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      return;
    }

    const orgId = currentOrgId() ?? undefined;
    await this.queue.addBulk(
      contacts.map((ct) => ({
        name: "send",
        data: { kind: "send", campaignId, contactId: ct.id, orgId },
      })),
    );
  }

  async cancel(id: string): Promise<CampaignDto> {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Difusión no encontrada");
    await this.prisma.campaign.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return this.getById(id);
  }

  // Marca COMPLETED cuando ya se procesaron todos los destinatarios.
  async checkCompletion(campaignId: string): Promise<void> {
    const c = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!c || c.status !== "RUNNING") return;
    const processed = c.sentCount + c.failedCount;
    if (processed >= c.totalRecipients) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }
  }

  private audienceWhere(tagIds: string[]): Prisma.ContactWhereInput {
    return {
      optIn: true,
      ...(tagIds.length ? { tags: { some: { tagId: { in: tagIds } } } } : {}),
    };
  }

  private toDto(c: {
    id: string;
    name: string;
    status: string;
    scheduledAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    variableValues: unknown;
    totalRecipients: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    createdAt: Date;
    template: { id: string; name: string };
    channel?: {
      id: string;
      label: string | null;
      displayPhoneNumber: string | null;
    } | null;
    tags: { tagId: string }[];
  }): CampaignDto {
    return {
      id: c.id,
      name: c.name,
      status: c.status as CampaignStatusValue,
      template: { id: c.template.id, name: c.template.name },
      channel: c.channel
        ? {
            id: c.channel.id,
            label: c.channel.label,
            displayPhoneNumber: c.channel.displayPhoneNumber,
          }
        : null,
      tagIds: c.tags.map((t) => t.tagId),
      fill: normalizeFill(c.variableValues),
      scheduledAt: c.scheduledAt?.toISOString() ?? null,
      startedAt: c.startedAt?.toISOString() ?? null,
      completedAt: c.completedAt?.toISOString() ?? null,
      totalRecipients: c.totalRecipients,
      sentCount: c.sentCount,
      deliveredCount: c.deliveredCount,
      readCount: c.readCount,
      failedCount: c.failedCount,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
