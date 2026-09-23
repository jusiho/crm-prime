import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { env } from "../../common/utils/env";
import type {
  FileContent,
  StorageProvider,
  StoredFile,
} from "./storage.provider";

// Extensión por tipo, solo para que los ficheros en disco sean reconocibles.
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

/**
 * Almacenamiento en disco, para desarrollo y despliegues de un solo nodo.
 * Los ficheros van a MEDIA_DIR (por defecto ./storage) y se sirven por la
 * API con autenticación, nunca como estáticos públicos.
 *
 * El tipo MIME se guarda en el propio nombre del fichero (`<uuid>.<ext>`)
 * para no necesitar una tabla aparte solo para eso.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private readonly logger = new Logger("Storage");
  private readonly dir = resolve(env("MEDIA_DIR") ?? "./storage");
  private ready: Promise<void> | null = null;

  private async ensureDir(): Promise<void> {
    this.ready ??= mkdir(this.dir, { recursive: true }).then(() => {
      this.logger.log(`Almacenamiento local en ${this.dir}`);
    });
    return this.ready;
  }

  async save(
    buffer: Buffer,
    mimeType: string,
    _originalName?: string,
  ): Promise<StoredFile> {
    await this.ensureDir();
    const ext = EXT[mimeType] ?? "bin";
    const id = `${randomUUID()}.${ext}`;
    await writeFile(join(this.dir, id), buffer);
    return { id, mimeType, size: buffer.byteLength };
  }

  async read(id: string): Promise<FileContent | null> {
    // El id viene de la URL: hay que impedir que se salga del directorio.
    const safe = this.safeName(id);
    if (!safe) return null;
    try {
      const buffer = await readFile(join(this.dir, safe));
      return {
        buffer,
        mimeType: this.mimeFrom(safe),
        size: buffer.byteLength,
      };
    } catch {
      return null;
    }
  }

  async remove(id: string): Promise<void> {
    const safe = this.safeName(id);
    if (!safe) return;
    await unlink(join(this.dir, safe)).catch(() => undefined);
  }

  // Solo "<uuid>.<ext>": nada de barras, "..", ni rutas absolutas.
  private safeName(id: string): string | null {
    return /^[A-Za-z0-9-]+\.[A-Za-z0-9]+$/.test(id) ? id : null;
  }

  private mimeFrom(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const found = Object.entries(EXT).find(([, e]) => e === ext);
    return found?.[0] ?? "application/octet-stream";
  }
}
