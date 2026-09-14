import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  STORAGE_PROVIDER,
  toStorageRef,
  type StorageProvider,
} from "../../infra/storage/storage.provider";

// Lo que WhatsApp acepta como imagen o documento, acotado a lo razonable.
const MAX_BYTES = 16 * 1024 * 1024; // límite de Meta para medios
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

interface UploadedMedia {
  /** Referencia interna ("storage://…") que se manda luego en sendMessage. */
  mediaUrl: string;
  /** URL para previsualizarlo en el CRM. */
  previewUrl: string;
  kind: "IMAGE" | "DOCUMENT";
  mimeType: string;
  size: number;
  fileName: string;
}

/**
 * Subida y descarga de medios del inbox.
 *
 * El fichero se guarda en nuestro almacenamiento y se envía a WhatsApp
 * subiéndolo a Meta en el momento del envío (por media id), no por URL
 * pública: así no hace falta exponer nada a internet.
 */
@Controller("media")
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadedMedia> {
    if (!file) throw new BadRequestException("No se recibió ningún archivo");

    const mimeType = file.mimetype;
    const isImage = IMAGE_TYPES.includes(mimeType);
    if (!isImage && !DOC_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Tipo no admitido: ${mimeType}. Imágenes JPG/PNG/WebP o documentos PDF, Word, Excel, TXT y CSV.`,
      );
    }

    const stored = await this.storage.save(
      file.buffer,
      mimeType,
      file.originalname,
    );
    return {
      mediaUrl: toStorageRef(stored.id),
      previewUrl: `/api/v1/media/${stored.id}`,
      kind: isImage ? "IMAGE" : "DOCUMENT",
      mimeType,
      size: stored.size,
      fileName: file.originalname,
    };
  }

  // Sirve el fichero con autenticación: nunca como estático público.
  @Get(":id")
  async serve(@Param("id") id: string, @Res() res: Response): Promise<void> {
    const file = await this.storage.read(id);
    if (!file) throw new NotFoundException("Archivo no encontrado");
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Length", String(file.size));
    // Inmutable: el id es único por fichero, nunca se reescribe.
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.end(file.buffer);
  }
}
