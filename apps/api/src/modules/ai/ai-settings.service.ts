import { Injectable, Logger } from "@nestjs/common";
import type {
  AiSettingsDto,
  ApiKeyState,
  LlmProviderName,
  UpdateAiSettingsInput,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TenantService } from "../../infra/tenant/tenant.service";
import { env } from "../../common/utils/env";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "../../common/utils/secret-box";


// Credenciales ya resueltas (BD con respaldo del entorno) para una llamada.
export interface ResolvedCredentials {
  provider: Exclude<LlmProviderName, "auto">;
  apiKey: string | null;
  model: string;
  baseUrl: string | null;
}

interface KeySource {
  key: string | null;
  source: ApiKeyState["source"];
}

/**
 * Fuente de verdad de qué proveedor de IA se usa y con qué credencial.
 * Prioridad para cada key: la guardada en BD (cifrada) y, si no hay, la
 * variable de entorno. Así el .env sigue funcionando sin configurar nada.
 *
 * Se cachea unos segundos para no golpear la BD en cada llamada al LLM;
 * al guardar desde Ajustes la caché se invalida al instante.
 */
@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger("AiSettings");
  // Caché por organización. Una sola entrada global serviría la configuración
  // de una empresa a otra en cuanto haya más de una.
  private cache = new Map<string, { row: SettingsRow; at: number }>();
  private static readonly TTL_MS = 15_000;

  constructor(

    private readonly prisma: PrismaService,

    private readonly tenant: TenantService,

  ) {}

  // ── Lectura para la UI (nunca devuelve keys en claro) ───────
  async getSettings(): Promise<AiSettingsDto> {
    const row = await this.load();
    const openai = this.keyFor("openai", row);
    const anthropic = this.keyFor("anthropic", row);
    const active = this.resolveFrom(row, openai, anthropic);

    return {
      provider: row.provider as LlmProviderName,
      openaiModel: row.openaiModel,
      anthropicModel: row.anthropicModel,
      openaiBaseUrl: row.openaiBaseUrl,
      openaiKey: this.toState(openai),
      anthropicKey: this.toState(anthropic),
      activeProvider: active.provider,
      activeModel: active.model,
    };
  }

  async updateSettings(input: UpdateAiSettingsInput): Promise<AiSettingsDto> {
    await this.load(); // garantiza que la fila existe
    const data: Record<string, unknown> = {};

    if (input.provider !== undefined) data.provider = input.provider;
    if (input.openaiModel !== undefined) data.openaiModel = input.openaiModel;
    if (input.anthropicModel !== undefined) {
      data.anthropicModel = input.anthropicModel;
    }
    if (input.openaiBaseUrl !== undefined) {
      data.openaiBaseUrl = input.openaiBaseUrl?.trim() || null;
    }
    // Cadena vacía = borrar la key de la BD y volver a la del entorno.
    if (input.openaiKey !== undefined) {
      data.openaiKeyEnc = input.openaiKey.trim()
        ? encryptSecret(input.openaiKey.trim())
        : null;
    }
    if (input.anthropicKey !== undefined) {
      data.anthropicKeyEnc = input.anthropicKey.trim()
        ? encryptSecret(input.anthropicKey.trim())
        : null;
    }

    const orgId = this.tenant.orgId();
    await this.prisma.aiSetting.update({ where: { orgId }, data });
    this.cache.delete(orgId);
    return this.getSettings();
  }

  // ── Resolución para los adaptadores de LLM ──────────────────
  async resolve(): Promise<ResolvedCredentials> {
    const row = await this.load();
    return this.resolveFrom(
      row,
      this.keyFor("openai", row),
      this.keyFor("anthropic", row),
    );
  }

  // Credenciales de un proveedor concreto (para "Probar conexión").
  async resolveFor(
    provider: Exclude<LlmProviderName, "auto">,
  ): Promise<ResolvedCredentials> {
    const row = await this.load();
    if (provider === "fake") {
      return { provider: "fake", apiKey: null, model: "fake", baseUrl: null };
    }
    if (provider === "openai") {
      return {
        provider: "openai",
        apiKey: this.keyFor("openai", row).key,
        model: row.openaiModel,
        baseUrl: row.openaiBaseUrl,
      };
    }
    return {
      provider: "anthropic",
      apiKey: this.keyFor("anthropic", row).key,
      model: row.anthropicModel,
      baseUrl: null,
    };
  }

  invalidate(): void {
    this.cache.delete(this.tenant.orgId());
  }

  // ── Internos ────────────────────────────────────────────────
  private resolveFrom(
    row: SettingsRow,
    openai: KeySource,
    anthropic: KeySource,
  ): ResolvedCredentials {
    const forced = row.provider as LlmProviderName;

    if (forced === "openai") {
      return {
        provider: "openai",
        apiKey: openai.key,
        model: row.openaiModel,
        baseUrl: row.openaiBaseUrl,
      };
    }
    if (forced === "anthropic") {
      return {
        provider: "anthropic",
        apiKey: anthropic.key,
        model: row.anthropicModel,
        baseUrl: null,
      };
    }
    if (forced === "fake") {
      return { provider: "fake", apiKey: null, model: "fake", baseUrl: null };
    }

    // "auto": el primero que tenga credencial.
    if (openai.key) {
      return {
        provider: "openai",
        apiKey: openai.key,
        model: row.openaiModel,
        baseUrl: row.openaiBaseUrl,
      };
    }
    if (anthropic.key) {
      return {
        provider: "anthropic",
        apiKey: anthropic.key,
        model: row.anthropicModel,
        baseUrl: null,
      };
    }
    return { provider: "fake", apiKey: null, model: "fake", baseUrl: null };
  }

  private keyFor(which: "openai" | "anthropic", row: SettingsRow): KeySource {
    const enc = which === "openai" ? row.openaiKeyEnc : row.anthropicKeyEnc;
    if (enc) {
      const plain = decryptSecret(enc);
      if (plain) return { key: plain, source: "db" };
      this.logger.warn(
        `No se pudo descifrar la key de ${which} (¿cambió APP_ENCRYPTION_KEY?). Se usa el entorno.`,
      );
    }
    const fromEnv =
      which === "openai" ? env("OPENAI_API_KEY") : env("ANTHROPIC_API_KEY");
    if (fromEnv) return { key: fromEnv, source: "env" };
    return { key: null, source: "none" };
  }

  private toState(src: KeySource): ApiKeyState {
    return {
      configured: !!src.key,
      source: src.source,
      masked: src.key ? maskSecret(src.key) : null,
    };
  }

  private async load(): Promise<SettingsRow> {
    const orgId = this.tenant.orgId();
    const now = Date.now();
    const hit = this.cache.get(orgId);
    if (hit && now - hit.at < AiSettingsService.TTL_MS) {
      return hit.row;
    }
    const row = await this.prisma.aiSetting.upsert({
      where: { orgId },
      create: { orgId },
      update: {},
    });
    this.cache.set(orgId, { row, at: now });
    return row;
  }
}

type SettingsRow = {
  provider: string;
  openaiKeyEnc: string | null;
  anthropicKeyEnc: string | null;
  openaiModel: string;
  anthropicModel: string;
  openaiBaseUrl: string | null;
};
