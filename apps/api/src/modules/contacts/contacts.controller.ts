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
  type ContactDto,
  type ContactListItem,
  type CreateContactInput,
  type UpdateContactInput,
} from "@crm/shared";
import type { Prisma } from "@prisma/client";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Controller("contacts")
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly prisma: PrismaService) {}

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
      include: { tags: { include: { tag: true } }, source: true },
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
      fields: this.fieldsFrom(c.metadata),
    }));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createContactSchema)) body: CreateContactInput,
  ): Promise<{ id: string }> {
    // Ya viene normalizado a E.164 por el esquema (phoneField).
    const phone = body.phone;
    const existing = await this.prisma.contact.findUnique({ where: { phone } });
    if (existing) {
      throw new ConflictException("Ya existe un contacto con ese teléfono");
    }
    const c = await this.prisma.contact.create({
      data: {
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
