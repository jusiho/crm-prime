import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  ApiKeyDto,
  ApiScope,
  CreateApiKeyInput,
  CreatedApiKey,
  UpdateApiKeyInput,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TenantService } from "../../infra/tenant/tenant.service";
import { runInOrg, runUnscoped } from "../../infra/tenant/tenant.context";

// Formato: crm_<8 hex de prefijo>_<48 hex de secreto>
const PREFIX_BYTES = 4;
const SECRET_BYTES = 24;

// Clave ya verificada, para que el guard la deje en la request.
export interface AuthenticatedApiKey {
  id: string;
  name: string;
  scopes: ApiScope[];
  /** Empresa dueña de la clave. De aquí sale el contexto de la petición. */
  orgId: string;
}

/**
 * Claves de API que el CRM emite para integraciones entrantes.
 *
 * Solo se guarda el SHA-256 del secreto: la clave completa se enseña una
 * única vez al crearla y después es irrecuperable. El prefijo va en claro
 * para poder localizar la fila sin escanear toda la tabla y para mostrarla
 * en el listado.
 *
 * Se usa SHA-256 y no bcrypt a propósito: esto se verifica en cada llamada
 * del webhook, y el secreto tiene 192 bits de entropía aleatoria, así que no
 * hay nada que un hash lento proteja (no es una contraseña adivinable).
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger("ApiKeys");

  constructor(

    private readonly prisma: PrismaService,

    private readonly tenant: TenantService,

  ) {}

  async list(): Promise<ApiKeyDto[]> {
    const rows = await this.prisma.apiKey.findMany({
      orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
      include: { createdBy: { select: { name: true, email: true } } },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    input: CreateApiKeyInput,
    userId: string | null,
  ): Promise<CreatedApiKey> {
    const prefix = `crm_${randomBytes(PREFIX_BYTES).toString("hex")}`;
    const secretPart = randomBytes(SECRET_BYTES).toString("hex");
    const secret = `${prefix}_${secretPart}`;

    const row = await this.prisma.apiKey.create({
      data: {
        orgId: this.tenant.orgId(),
        name: input.name.trim(),
        prefix,
        secretHash: this.hash(secret),
        scopes: input.scopes,
        createdById: userId,
      },
      include: { createdBy: { select: { name: true, email: true } } },
    });
    this.logger.log(`Clave de API creada: ${row.name} (${prefix})`);

    return { key: this.toDto(row), secret };
  }

  async update(id: string, input: UpdateApiKeyInput): Promise<ApiKeyDto> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Clave no encontrada");
    const row = await this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
      },
      include: { createdBy: { select: { name: true, email: true } } },
    });
    return this.toDto(row);
  }

  // Revocar en vez de borrar: se conserva el rastro de qué integración era.
  async revoke(id: string): Promise<ApiKeyDto> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Clave no encontrada");
    const row = await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: existing.revokedAt ?? new Date() },
      include: { createdBy: { select: { name: true, email: true } } },
    });
    this.logger.warn(`Clave de API revocada: ${row.name} (${row.prefix})`);
    return this.toDto(row);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Clave no encontrada");
    await this.prisma.apiKey.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Verifica una clave presentada por un cliente. Devuelve null si no vale
   * (inexistente, revocada o secreto incorrecto), sin distinguir el motivo.
   */
  async verify(presented: string): Promise<AuthenticatedApiKey | null> {
    const raw = presented.trim();
    // El prefijo son los dos primeros segmentos: "crm_a1b2c3d4".
    const parts = raw.split("_");
    if (parts.length !== 3 || parts[0] !== "crm") return null;
    const prefix = `${parts[0]}_${parts[1]}`;

    // Agujero 3/4: igual que el webhook, la clave identifica a la empresa;
    // no se puede filtrar por una empresa que aún no se conoce.
    const row = await runUnscoped("auth: resolver clave de API por prefijo", () =>
      this.prisma.apiKey.findUnique({ where: { prefix } }),
    );
    if (!row || row.revokedAt) return null;

    const a = Buffer.from(this.hash(raw), "hex");
    const b = Buffer.from(row.secretHash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    // El contador es informativo: si falla, no debe tumbar la petición.
    void runInOrg(row.orgId, () =>
      this.prisma.apiKey.update({
        where: { id: row.id },
        data: { lastUsedAt: new Date(), useCount: { increment: 1 } },
      }),
    )
      .catch((e: Error) =>
        this.logger.warn(`No se pudo registrar el uso de ${prefix}: ${e.message}`),
      );

    return {
      id: row.id,
      name: row.name,
      orgId: row.orgId,
      scopes: row.scopes as ApiScope[],
    };
  }

  private hash(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }

  private toDto(r: {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    lastUsedAt: Date | null;
    useCount: number;
    revokedAt: Date | null;
    createdAt: Date;
    createdBy?: { name: string | null; email: string } | null;
  }): ApiKeyDto {
    return {
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      scopes: r.scopes as ApiScope[],
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      useCount: r.useCount,
      revokedAt: r.revokedAt?.toISOString() ?? null,
      createdByName: r.createdBy?.name ?? r.createdBy?.email ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
