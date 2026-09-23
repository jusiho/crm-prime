import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  createContactSchema,
  updateContactSchema,
  utmKeys,
  type ContactDto,
  type ContactListItem,
  type CreateContactInput,
  type UpdateContactInput,
} from "@crm/shared";
import { Prisma } from "@prisma/client";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TenantService } from "../../infra/tenant/tenant.service";

@Controller("contacts")
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  // Autocompletar (id/name/phone) — lo usa el pipeline.
  @Get()
  async list(@Query("search") search?: string): Promise<ContactDto[]> {
    const rows = await this.prisma.contact.findMany({
      where: search ? this.searchWhere(search) : undefined,
      orderBy: { lastMessageAt: "desc" },
      take: 20,
    });
    return rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  }

  // Directorio completo para la sección de Contactos.
  @Get("directory")
  async directory(
    @Query("search") search?: string,
  ): Promise<ContactListItem[]> {
    const rows = await this.prisma.contact.findMany({
      where: search ? this.searchWhere(search) : undefined,
      orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
      take: 200,
      include: {
        tags: { include: { tag: true } },
        source: true,
        // Solo la conversación que trae anuncio: es la que da la atribución.
        conversations: {
          where: { referral: { not: Prisma.DbNull } },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { referral: true },
        },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      optIn: c.optIn,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      tags: c.tags.map((ct) => ({ name: ct.tag.name, color: ct.tag.color })),
      source: c.source
        ? { id: c.source.id, name: c.source.name, color: c.source.color }
        : null,
      origin: (c.origin ?? "manual") as ContactListItem["origin"],
      originDetail: c.originDetail,
      attribution: {
        utms: this.utmsFrom(c.metadata),
        ad: this.adFrom(c.conversations[0]?.referral),
      },
      // Sin los utm_*: van en `attribution`, y si salieran también aquí el
      // panel los reescribiría como si fueran campos editables del negocio.
      fields: this.businessFields(c.metadata),
    }));
  }

  // Los utm_* viven en metadata junto a los campos personalizados, pero son
  // otra cosa: datos de marketing que nadie edita a mano. Se separan aquí
  // para que la UI pueda tratarlos como lo que son.
  private utmsFrom(metadata: unknown): Record<string, string> {
    const all = this.fieldsFrom(metadata);
    const out: Record<string, string> = {};
    for (const key of utmKeys) {
      if (all[key]) out[key] = all[key];
    }
    return out;
  }

  private businessFields(metadata: unknown): Record<string, string> {
    const all = this.fieldsFrom(metadata);
    for (const key of utmKeys) delete all[key];
    return all;
  }

  private adFrom(referral: unknown): ContactListItem["attribution"]["ad"] {
    if (!referral || typeof referral !== "object") return null;
    const r = referral as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v ? v : null);
    return {
      sourceId: str(r.sourceId),
      headline: str(r.headline),
      body: str(r.body),
      sourceUrl: str(r.sourceUrl),
      ctwaClid: str(r.ctwaClid),
    };
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createContactSchema)) body: CreateContactInput,
  ): Promise<{ id: string }> {
    // Ya viene normalizado a E.164 por el esquema (phoneField).
    const phone = body.phone;
    const existing = await this.prisma.contact.findFirst({ where: { phone } });
    if (existing) {
      throw new ConflictException("Ya existe un contacto con ese teléfono");
    }
    const c = await this.prisma.contact.create({
      data: {
        orgId: this.tenant.orgId(),
        phone,
        name: body.name,
        sourceId: body.sourceId,
        origin: "manual",
      },
    });
    return { id: c.id };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateContactSchema)) body: UpdateContactInput,
  ): Promise<{ ok: true }> {
    const existing = await this.prisma.contact.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contacto no encontrado");

    // Campos personalizados: fusionar con la metadata existente.
    const metadata =
      body.fields !== undefined
        ? ({
            ...this.fieldsFrom(existing.metadata),
            ...body.fields,
          } as Prisma.InputJsonValue)
        : undefined;

    await this.prisma.contact.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.optIn !== undefined ? { optIn: body.optIn } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
    return { ok: true };
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

  private searchWhere(search: string) {
    return {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search } },
      ],
    };
  }
}
