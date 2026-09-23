import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CreateFlowInput,
  FlowChannelRef,
  FlowDto,
  FlowEdge,
  FlowNode,
  FlowSummary,
  FlowTriggerType,
  UpdateFlowInput,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TenantService } from "../../infra/tenant/tenant.service";

@Injectable()
export class FlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  async list(): Promise<{
    flows: FlowSummary[];
    channels: FlowChannelRef[];
    bots: { id: string; name: string }[];
    agents: { id: string; name: string | null; email: string }[];
  }> {
    const [rows, channels, bots, agents] = await Promise.all([
      this.prisma.flow.findMany({
        orderBy: { updatedAt: "desc" },
        include: { channel: true },
      }),
      this.prisma.whatsappConnection.findMany({
        where: { isActive: true },
        orderBy: { connectedAt: "desc" },
      }),
      this.prisma.agentConfig.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return {
      flows: rows.map((f) => ({
        id: f.id,
        name: f.name,
        isActive: f.isActive,
        triggerType: f.triggerType as FlowTriggerType,
        channel: f.channel
          ? {
              id: f.channel.id,
              label: f.channel.label,
              displayPhoneNumber: f.channel.displayPhoneNumber,
            }
          : null,
        nodeCount: Array.isArray(f.nodes) ? (f.nodes as unknown[]).length : 0,
        updatedAt: f.updatedAt.toISOString(),
      })),
      channels: channels.map((c) => ({
        id: c.id,
        label: c.label,
        displayPhoneNumber: c.displayPhoneNumber,
      })),
      bots,
      agents,
    };
  }

  async getById(id: string): Promise<FlowDto> {
    const f = await this.prisma.flow.findUnique({
      where: { id },
      include: { channel: true },
    });
    if (!f) throw new NotFoundException("Flujo no encontrado");
    return this.toDto(f);
  }

  async create(input: CreateFlowInput): Promise<FlowDto> {
    const f = await this.prisma.flow.create({
      data: {
        orgId: this.tenant.orgId(),
        name: input.name,
        isActive: input.isActive,
        channelId: input.channelId,
        triggerType: input.triggerType,
        triggerKeywords: input.triggerKeywords,
        nodes: input.nodes as unknown as Prisma.InputJsonValue,
        edges: input.edges as unknown as Prisma.InputJsonValue,
      },
      include: { channel: true },
    });
    return this.toDto(f);
  }

  async update(id: string, input: UpdateFlowInput): Promise<FlowDto> {
    const existing = await this.prisma.flow.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Flujo no encontrado");
    const f = await this.prisma.flow.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.channelId !== undefined ? { channelId: input.channelId } : {}),
        ...(input.triggerType !== undefined
          ? { triggerType: input.triggerType }
          : {}),
        ...(input.triggerKeywords !== undefined
          ? { triggerKeywords: input.triggerKeywords }
          : {}),
        ...(input.nodes !== undefined
          ? { nodes: input.nodes as unknown as Prisma.InputJsonValue }
          : {}),
        ...(input.edges !== undefined
          ? { edges: input.edges as unknown as Prisma.InputJsonValue }
          : {}),
      },
      include: { channel: true },
    });
    return this.toDto(f);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const f = await this.prisma.flow.findUnique({ where: { id } });
    if (!f) throw new NotFoundException("Flujo no encontrado");
    await this.prisma.flow.delete({ where: { id } });
    return { ok: true };
  }

  private toDto(f: {
    id: string;
    name: string;
    isActive: boolean;
    channelId: string | null;
    triggerType: string;
    triggerKeywords: string[];
    nodes: unknown;
    edges: unknown;
    createdAt: Date;
    updatedAt: Date;
    channel?: {
      id: string;
      label: string | null;
      displayPhoneNumber: string | null;
    } | null;
  }): FlowDto {
    return {
      id: f.id,
      name: f.name,
      isActive: f.isActive,
      channelId: f.channelId,
      channel: f.channel
        ? {
            id: f.channel.id,
            label: f.channel.label,
            displayPhoneNumber: f.channel.displayPhoneNumber,
          }
        : null,
      triggerType: f.triggerType as FlowTriggerType,
      triggerKeywords: f.triggerKeywords,
      nodes: (f.nodes as FlowNode[] | null) ?? [],
      edges: (f.edges as FlowEdge[] | null) ?? [],
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    };
  }
}
