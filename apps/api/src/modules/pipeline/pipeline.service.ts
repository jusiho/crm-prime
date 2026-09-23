import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
  CreateDealInput,
  CreateStageInput,
  DealDto,
  MoveDealInput,
  PipelineDto,
  ReorderStagesInput,
  StageDto,
  UpdateDealInput,
  UpdateStageInput,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TenantService } from "../../infra/tenant/tenant.service";

const DEAL_INCLUDE = { contact: true, owner: true } as const;

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly events: EventEmitter2,
  ) {}

  async getPipeline(): Promise<PipelineDto> {
    const [stages, deals] = await Promise.all([
      this.prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
      this.prisma.deal.findMany({
        orderBy: { createdAt: "desc" },
        include: DEAL_INCLUDE,
      }),
    ]);
    return {
      stages: stages.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        isWon: s.isWon,
        isLost: s.isLost,
      })),
      deals: deals.map((d) => this.toDealDto(d)),
    };
  }

  async createDeal(input: CreateDealInput): Promise<DealDto> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: input.contactId },
    });
    if (!contact) throw new NotFoundException("Contacto no encontrado");

    const stageId =
      input.stageId ??
      (await this.prisma.pipelineStage.findFirst({ orderBy: { order: "asc" } }))
        ?.id;
    if (!stageId) throw new BadRequestException("No hay etapas configuradas");

    const deal = await this.prisma.deal.create({
      data: {
        orgId: this.tenant.orgId(),
        contactId: input.contactId,
        stageId,
        title: input.title,
        value: input.value,
        currency: input.currency,
      },
      include: DEAL_INCLUDE,
    });
    this.events.emit("pipeline.changed", { dealId: deal.id });
    return this.toDealDto(deal);
  }

  async moveDeal(id: string, input: MoveDealInput): Promise<DealDto> {
    const stage = await this.prisma.pipelineStage.findUnique({
      where: { id: input.stageId },
    });
    if (!stage) throw new BadRequestException("Etapa inválida");

    const deal = await this.prisma.deal
      .update({
        where: { id },
        data: { stageId: input.stageId },
        include: DEAL_INCLUDE,
      })
      .catch(() => {
        throw new NotFoundException("Deal no encontrado");
      });
    this.events.emit("pipeline.changed", { dealId: deal.id });
    return this.toDealDto(deal);
  }

  async updateDeal(id: string, input: UpdateDealInput): Promise<DealDto> {
    const deal = await this.prisma.deal
      .update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.value !== undefined ? { value: input.value } : {}),
          ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        },
        include: DEAL_INCLUDE,
      })
      .catch(() => {
        throw new NotFoundException("Deal no encontrado");
      });
    this.events.emit("pipeline.changed", { dealId: deal.id });
    return this.toDealDto(deal);
  }

  async deleteDeal(id: string): Promise<{ ok: true }> {
    const deal = await this.prisma.deal.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException("Deal no encontrado");
    await this.prisma.deal.delete({ where: { id } });
    this.events.emit("pipeline.changed", { dealId: id });
    return { ok: true };
  }

  // ── Etapas (columnas) ───────────────────────────────────────
  async createStage(input: CreateStageInput): Promise<StageDto> {
    const last = await this.prisma.pipelineStage.findFirst({
      orderBy: { order: "desc" },
    });
    const s = await this.prisma.pipelineStage.create({
      data: {
        orgId: this.tenant.orgId(),
        name: input.name,
        isWon: input.isWon,
        isLost: input.isLost,
        order: (last?.order ?? -1) + 1,
      },
    });
    this.events.emit("pipeline.changed", { dealId: "" });
    return this.toStageDto(s);
  }

  async updateStage(id: string, input: UpdateStageInput): Promise<StageDto> {
    const s = await this.prisma.pipelineStage
      .update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.isWon !== undefined ? { isWon: input.isWon } : {}),
          ...(input.isLost !== undefined ? { isLost: input.isLost } : {}),
        },
      })
      .catch(() => {
        throw new NotFoundException("Etapa no encontrada");
      });
    this.events.emit("pipeline.changed", { dealId: "" });
    return this.toStageDto(s);
  }

  async deleteStage(id: string): Promise<{ ok: true }> {
    const count = await this.prisma.deal.count({ where: { stageId: id } });
    if (count > 0) {
      throw new BadRequestException(
        "La etapa tiene deals. Muévelos a otra etapa antes de borrarla.",
      );
    }
    await this.prisma.pipelineStage.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Etapa no encontrada");
    });
    this.events.emit("pipeline.changed", { dealId: "" });
    return { ok: true };
  }

  // Reordena: usa órdenes negativos temporales para no chocar con @@unique.
  async reorderStages(input: ReorderStagesInput): Promise<{ ok: true }> {
    await this.prisma.$transaction([
      ...input.ids.map((id, i) =>
        this.prisma.pipelineStage.update({
          where: { id },
          data: { order: -(i + 1) },
        }),
      ),
      ...input.ids.map((id, i) =>
        this.prisma.pipelineStage.update({
          where: { id },
          data: { order: i },
        }),
      ),
    ]);
    this.events.emit("pipeline.changed", { dealId: "" });
    return { ok: true };
  }

  private toStageDto(s: {
    id: string;
    name: string;
    order: number;
    isWon: boolean;
    isLost: boolean;
  }): StageDto {
    return { id: s.id, name: s.name, order: s.order, isWon: s.isWon, isLost: s.isLost };
  }

  private toDealDto(d: {
    id: string;
    title: string;
    value: unknown;
    currency: string;
    stageId: string;
    createdAt: Date;
    contact: { id: string; name: string | null; phone: string; metadata?: unknown };
    owner?: { id: string; name: string | null } | null;
  }): DealDto {
    return {
      id: d.id,
      title: d.title,
      value: d.value === null ? null : Number(d.value),
      currency: d.currency,
      stageId: d.stageId,
      contact: {
        id: d.contact.id,
        name: d.contact.name,
        phone: d.contact.phone,
        fields: this.fieldsFrom(d.contact.metadata),
      },
      owner: d.owner ? { id: d.owner.id, name: d.owner.name } : null,
      createdAt: d.createdAt.toISOString(),
    };
  }

  private fieldsFrom(metadata: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (metadata && typeof metadata === "object") {
      for (const [k, v] of Object.entries(metadata as Record<string, unknown>)) {
        if (v != null) out[k] = String(v);
      }
    }
    return out;
  }
}
