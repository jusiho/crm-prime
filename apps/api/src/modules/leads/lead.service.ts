import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CreateCustomFieldInput,
  CustomFieldDto,
  CustomFieldType,
  LeadWebhookInput,
  UpdateCustomFieldInput,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TenantService } from "../../infra/tenant/tenant.service";

@Injectable()
export class LeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  // ── Campos personalizados (definiciones) ─────────────────────
  async listFields(): Promise<CustomFieldDto[]> {
    const rows = await this.prisma.customField.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((f) => this.toFieldDto(f));
  }

  async createField(input: CreateCustomFieldInput): Promise<CustomFieldDto> {
    const key = await this.uniqueKey(this.slug(input.label));
    const count = await this.prisma.customField.count();
    const f = await this.prisma.customField.create({
      data: {
        orgId: this.tenant.orgId(),
        key,
        label: input.label,
        type: input.type,
        options: input.type === "select" ? input.options : [],
        order: count,
      },
    });
    return this.toFieldDto(f);
  }

  async updateField(
    id: string,
    input: UpdateCustomFieldInput,
  ): Promise<CustomFieldDto> {
    const existing = await this.prisma.customField.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Campo no encontrado");
    const f = await this.prisma.customField.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.options !== undefined ? { options: input.options } : {}),
        ...(input.order !== undefined ? { order: input.order } : {}),
      },
    });
    return this.toFieldDto(f);
  }

  async removeField(id: string): Promise<{ ok: true }> {
    const f = await this.prisma.customField.findUnique({ where: { id } });
    if (!f) throw new NotFoundException("Campo no encontrado");
    await this.prisma.customField.delete({ where: { id } });
    return { ok: true };
  }

  // ── Webhook de lead entrante ─────────────────────────────────
  async ingestLead(
    input: LeadWebhookInput,
    // Nombre de la clave de API que autenticó la llamada, si la hubo.
    // Es la procedencia fiable: la verifica el servidor, no el que llama.
    viaApiKey: string | null = null,
  ): Promise<{ id: string; created: boolean }> {
    // Ya viene normalizado a E.164 por el esquema (phoneField).
    const phone = input.phone;
    const orgId = this.tenant.orgId();
    const existing = await this.prisma.contact.findFirst({ where: { phone } });

    // Fuente: se crea si no existe.
    let sourceId: string | undefined;
    if (input.source?.trim()) {
      const source = await this.prisma.source.upsert({
        where: { orgId_name: { orgId, name: input.source.trim() } },
        create: { orgId, name: input.source.trim() },
        update: {},
      });
      sourceId = source.id;
    }

    // Campos personalizados → metadata (fusiona con lo existente).
    const metadata = {
      ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
      ...(input.fields ?? {}),
    } as Prisma.InputJsonValue;

    const contact = await this.prisma.contact.upsert({
      where: { orgId_phone: { orgId, phone } },
      create: {
        orgId,
        phone,
        name: input.name ?? null,
        optIn: input.optIn ?? true,
        ...(sourceId ? { sourceId } : {}),
        metadata,
        // Procedencia técnica: entró por el webhook, y de qué integración.
        origin: "webhook",
        originDetail:
          viaApiKey ?? input.integration?.trim() ?? input.source?.trim() ?? null,
      },
      update: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.optIn !== undefined ? { optIn: input.optIn } : {}),
        ...(sourceId ? { sourceId } : {}),
        metadata,
      },
    });

    // Etiquetas: crear y asociar.
    for (const tagName of input.tags ?? []) {
      const tag = await this.prisma.tag.upsert({
        where: { orgId_name: { orgId, name: tagName } },
        create: { orgId, name: tagName },
        update: {},
      });
      await this.prisma.contactTag
        .create({ data: { contactId: contact.id, tagId: tag.id } })
        .catch(() => undefined);
    }

    return { id: contact.id, created: !existing };
  }

  // ── Helpers ──────────────────────────────────────────────────
  private slug(label: string): string {
    return (
      label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || "campo"
    );
  }

  private async uniqueKey(base: string): Promise<string> {
    let key = base;
    let i = 1;
    while (await this.prisma.customField.findFirst({ where: { key } })) {
      key = `${base}_${i++}`;
    }
    return key;
  }

  private toFieldDto(f: {
    id: string;
    key: string;
    label: string;
    type: string;
    options: string[];
    order: number;
  }): CustomFieldDto {
    return {
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type as CustomFieldType,
      options: f.options,
      order: f.order,
    };
  }
}
