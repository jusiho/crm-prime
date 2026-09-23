import { Injectable, Logger } from "@nestjs/common";
import type {
  ApiKeyState,
  IntegrationSettingsDto,
  IntegrationTestResult,
  UpdateIntegrationSettingsInput,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TenantService } from "../../infra/tenant/tenant.service";
import { env } from "../../common/utils/env";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "../../common/utils/secret-box";


interface SecretSource {
  value: string | null;
  source: ApiKeyState["source"];
}

/**
 * Credenciales de terceros que consume el CRM (Voyage para embeddings,
 * WhatsApp a nivel de app de Meta), editables desde Ajustes › Integraciones.
 *
 * Mismo contrato que AiSettingsService: la BD manda, el .env es el respaldo,
 * y se cachea unos segundos porque esto se consulta en caliente (la firma de
 * cada webhook entrante, cada lote de embeddings).
 */
@Injectable()
export class IntegrationSettingsService {
  private readonly logger = new Logger("Integrations");
  // Caché por organización. Una sola entrada global serviría la configuración
  // de una empresa a otra en cuanto haya más de una.
  private cache = new Map<string, { row: SettingsRow; at: number }>();
  private static readonly TTL_MS = 15_000;

  constructor(

    private readonly prisma: PrismaService,

    private readonly tenant: TenantService,

  ) {}

  async getSettings(): Promise<IntegrationSettingsDto> {
    const row = await this.load();
    const voyage = this.secret(row.voyageKeyEnc, "VOYAGE_API_KEY");
    const appSecret = this.secret(
      row.whatsappAppSecretEnc,
      "WHATSAPP_APP_SECRET",
    );
    const verifyToken = this.secret(
      row.whatsappVerifyTokenEnc,
      "WHATSAPP_VERIFY_TOKEN",
    );

    return {
      voyageKey: this.toState(voyage),
      voyageModel: row.voyageModel,
      embeddingsProvider: voyage.value ? "voyage" : "fake",
      whatsappAppId: row.whatsappAppId ?? env("WHATSAPP_APP_ID") ?? null,
      whatsappAppSecret: this.toState(appSecret),
      whatsappVerifyToken: this.toState(verifyToken),
      whatsappGraphVersion: row.whatsappGraphVersion,
      webhookSignatureVerified: !!appSecret.value,
    };
  }

  async updateSettings(
    input: UpdateIntegrationSettingsInput,
  ): Promise<IntegrationSettingsDto> {
    await this.load();
    const data: Record<string, unknown> = {};

    if (input.voyageModel !== undefined) data.voyageModel = input.voyageModel;
    if (input.whatsappGraphVersion !== undefined) {
      data.whatsappGraphVersion = input.whatsappGraphVersion;
    }
    if (input.whatsappAppId !== undefined) {
      data.whatsappAppId = input.whatsappAppId?.trim() || null;
    }
    // Cadena vacía = borrar de la BD y volver a la variable de entorno.
    if (input.voyageKey !== undefined) {
      data.voyageKeyEnc = this.encodeOrNull(input.voyageKey);
    }
    if (input.whatsappAppSecret !== undefined) {
      data.whatsappAppSecretEnc = this.encodeOrNull(input.whatsappAppSecret);
    }
    if (input.whatsappVerifyToken !== undefined) {
      data.whatsappVerifyTokenEnc = this.encodeOrNull(input.whatsappVerifyToken);
    }

    const orgId = this.tenant.orgId();
    await this.prisma.integrationSetting.update({ where: { orgId }, data });
    this.cache.delete(orgId);
    return this.getSettings();
  }

  // ── Accesores para el resto de la app ───────────────────────
  async voyage(): Promise<{ apiKey: string | null; model: string }> {
    const row = await this.load();
    return {
      apiKey: this.secret(row.voyageKeyEnc, "VOYAGE_API_KEY").value,
      model: row.voyageModel || env("VOYAGE_MODEL") || "voyage-3.5",
    };
  }

  async whatsappAppSecret(): Promise<string | null> {
    const row = await this.load();
    return this.secret(row.whatsappAppSecretEnc, "WHATSAPP_APP_SECRET").value;
  }

  async whatsappVerifyToken(): Promise<string | null> {
    const row = await this.load();
    return this.secret(row.whatsappVerifyTokenEnc, "WHATSAPP_VERIFY_TOKEN")
      .value;
  }

  async whatsappApp(): Promise<{
    appId: string | null;
    appSecret: string | null;
    graphVersion: string;
  }> {
    const row = await this.load();
    return {
      appId: row.whatsappAppId ?? env("WHATSAPP_APP_ID") ?? null,
      appSecret: this.secret(row.whatsappAppSecretEnc, "WHATSAPP_APP_SECRET")
        .value,
      graphVersion:
        row.whatsappGraphVersion || env("WHATSAPP_GRAPH_VERSION") || "v21.0",
    };
  }

  // Llamada mínima real a Voyage para confirmar que la key sirve.
  async test(): Promise<IntegrationTestResult> {
    const { apiKey, model } = await this.voyage();
    if (!apiKey) {
      return {
        ok: false,
        message:
          "Sin API key de Voyage: los embeddings del RAG son simulados (búsqueda pobre).",
        latencyMs: 0,
      };
    }
    const started = Date.now();
    try {
      const res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: ["ping"], model }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          ok: false,
          message: `Voyage ${res.status}: ${detail.slice(0, 200)}`,
          latencyMs: Date.now() - started,
        };
      }
      const data = (await res.json()) as { data?: { embedding: number[] }[] };
      const dim = data.data?.[0]?.embedding?.length ?? 0;
      return {
        ok: true,
        message: `Conexión correcta con ${model} (vectores de ${dim} dimensiones).`,
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      return {
        ok: false,
        message: (e as Error).message.slice(0, 200),
        latencyMs: Date.now() - started,
      };
    }
  }

  invalidate(): void {
    this.cache.delete(this.tenant.orgId());
  }

  // ── Internos ────────────────────────────────────────────────
  private encodeOrNull(value: string): string | null {
    return value.trim() ? encryptSecret(value.trim()) : null;
  }

  private secret(enc: string | null, envVar: string): SecretSource {
    if (enc) {
      const plain = decryptSecret(enc);
      if (plain) return { value: plain, source: "db" };
      this.logger.warn(
        `No se pudo descifrar ${envVar} (¿cambió APP_ENCRYPTION_KEY?). Se usa el entorno.`,
      );
    }
    const fromEnv = env(envVar);
    if (fromEnv) return { value: fromEnv, source: "env" };
    return { value: null, source: "none" };
  }

  private toState(src: SecretSource): ApiKeyState {
    return {
      configured: !!src.value,
      source: src.source,
      masked: src.value ? maskSecret(src.value) : null,
    };
  }

  private async load(): Promise<SettingsRow> {
    const orgId = this.tenant.orgId();
    const now = Date.now();
    const hit = this.cache.get(orgId);
    if (hit && now - hit.at < IntegrationSettingsService.TTL_MS) {
      return hit.row;
    }
    const row = await this.prisma.integrationSetting.upsert({
      where: { orgId },
      create: { orgId },
      update: {},
    });
    this.cache.set(orgId, { row, at: now });
    return row;
  }
}

type SettingsRow = {
  voyageKeyEnc: string | null;
  voyageModel: string;
  whatsappAppId: string | null;
  whatsappAppSecretEnc: string | null;
  whatsappVerifyTokenEnc: string | null;
  whatsappGraphVersion: string;
};
