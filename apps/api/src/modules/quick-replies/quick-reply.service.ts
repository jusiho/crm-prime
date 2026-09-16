import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { MessageType } from "@prisma/client";
import type {
  CreateQuickReplyInput,
  QuickReplyDto,
  UpdateQuickReplyInput,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class QuickReplyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<QuickReplyDto[]> {
    const rows = await this.prisma.quickReply.findMany({
      orderBy: { shortcut: "asc" },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(input: CreateQuickReplyInput): Promise<QuickReplyDto> {
    await this.assertShortcutFree(input.shortcut);
    const row = await this.prisma.quickReply.create({
      data: {
        shortcut: input.shortcut,
        title: input.title,
        body: input.body,
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType as MessageType | null,
      },
    });
    return this.toDto(row);
  }

  async update(id: string, input: UpdateQuickReplyInput): Promise<QuickReplyDto> {
    const existing = await this.prisma.quickReply.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Respuesta rápida no encontrada");
    if (input.shortcut && input.shortcut !== existing.shortcut) {
      await this.assertShortcutFree(input.shortcut);
    }
    const row = await this.prisma.quickReply.update({
      where: { id },
      data: {
        ...(input.shortcut !== undefined ? { shortcut: input.shortcut } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.mediaUrl !== undefined ? { mediaUrl: input.mediaUrl } : {}),
        ...(input.mediaType !== undefined
          ? { mediaType: input.mediaType as MessageType | null }
          : {}),
      },
    });
    return this.toDto(row);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.quickReply.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Respuesta rápida no encontrada");
    await this.prisma.quickReply.delete({ where: { id } });
    return { ok: true };
  }

  private async assertShortcutFree(shortcut: string): Promise<void> {
    const taken = await this.prisma.quickReply.findUnique({ where: { shortcut } });
    if (taken) {
      throw new BadRequestException(`El atajo ${shortcut} ya está en uso.`);
    }
  }

  private toDto(r: {
    id: string;
    shortcut: string;
    title: string;
    body: string;
    mediaUrl: string | null;
    mediaType: string | null;
    createdAt: Date;
  }): QuickReplyDto {
    return {
      id: r.id,
      shortcut: r.shortcut,
      title: r.title,
      body: r.body,
      mediaUrl: r.mediaUrl,
      mediaType: r.mediaType as QuickReplyDto["mediaType"],
      createdAt: r.createdAt.toISOString(),
    };
  }
}
