import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CreateTemplateInput,
  TemplateDto,
  TemplateStatusValue,
  TemplateVariable,
  UpdateTemplateInput,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TenantService } from "../../infra/tenant/tenant.service";

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  async list(): Promise<TemplateDto[]> {
    const rows = await this.prisma.template.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map((t) => this.toDto(t));
  }

  async create(input: CreateTemplateInput): Promise<TemplateDto> {
    const t = await this.prisma.template.create({
      data: {
        orgId: this.tenant.orgId(),
        name: input.name,
        language: input.language,
        body: input.body,
        status: input.status,
        variables: input.variables as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDto(t);
  }

  async update(id: string, input: UpdateTemplateInput): Promise<TemplateDto> {
    const existing = await this.prisma.template.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Plantilla no encontrada");
    const t = await this.prisma.template.update({
      where: { id },
      data: {
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.variables !== undefined
          ? { variables: input.variables as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    return this.toDto(t);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const t = await this.prisma.template.findUnique({
      where: { id },
      include: { _count: { select: { campaigns: true } } },
    });
    if (!t) throw new NotFoundException("Plantilla no encontrada");
    await this.prisma.template.delete({ where: { id } });
    return { ok: true };
  }

  private toDto(t: {
    id: string;
    name: string;
    language: string;
    status: string;
    body: string;
    variables: unknown;
    createdAt: Date;
  }): TemplateDto {
    return {
      id: t.id,
      name: t.name,
      language: t.language,
      status: t.status as TemplateStatusValue,
      body: t.body,
      variables: (t.variables as TemplateVariable[] | null) ?? [],
      createdAt: t.createdAt.toISOString(),
    };
  }
}
