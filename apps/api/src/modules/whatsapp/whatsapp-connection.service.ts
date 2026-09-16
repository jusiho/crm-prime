import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type {
  ChannelTestResult,
  ConnectWhatsappInput,
  WhatsappChannel,
  WhatsappConnectionStatus,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { IntegrationSettingsService } from "../integrations/integration-settings.service";

export interface WhatsappCreds {
  token: string;
  phoneNumberId: string;
  version: string;
}

@Injectable()
export class WhatsappConnectionService {
  private readonly logger = new Logger("WhatsAppConnection");
  private readonly version = process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0";

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: IntegrationSettingsService,
  ) {}

  // ── Resolución de credenciales para enviar ───────────────────
  /**
   * Credenciales para enviar.
   * - Si se indica `phoneNumberId`, usa ese canal concreto (responder por el
   *   mismo número por el que entró la conversación).
   * - Si no, cae al primer canal activo o, en su defecto, al .env.
   */
  async resolveCreds(phoneNumberId?: string): Promise<WhatsappCreds | null> {
    if (phoneNumberId) {
      const conn = await this.prisma.whatsappConnection.findFirst({
        where: { phoneNumberId, isActive: true },
      });
      if (conn?.accessToken) {
        return {
          token: conn.accessToken,
          phoneNumberId: conn.phoneNumberId,
          version: this.version,
        };
      }
      // El número pedido es el del .env.
      if (
        phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_TOKEN
      ) {
        return {
          token: process.env.WHATSAPP_TOKEN,
          phoneNumberId,
          version: this.version,
        };
      }
      return null;
    }

    // Sin número específico: primer canal activo o .env.
    const conn = await this.prisma.whatsappConnection.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: "desc" },
    });
    if (conn?.accessToken && conn.phoneNumberId) {
      return {
        token: conn.accessToken,
        phoneNumberId: conn.phoneNumberId,
        version: this.version,
      };
    }
    const envToken = process.env.WHATSAPP_TOKEN;
    const envPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (envToken && envPhone) {
      return { token: envToken, phoneNumberId: envPhone, version: this.version };
    }
    return null;
  }

  /**
   * Credenciales de la cuenta de WhatsApp Business (WABA), que es donde viven
   * las plantillas. Usa el canal indicado o el primero activo que tenga WABA.
   */
  async resolveWabaCreds(
    phoneNumberId?: string,
  ): Promise<{ wabaId: string; token: string; version: string } | null> {
    const conn = await this.prisma.whatsappConnection.findFirst({
      where: {
        isActive: true,
        wabaId: { not: null },
        ...(phoneNumberId ? { phoneNumberId } : {}),
      },
      orderBy: { connectedAt: "desc" },
    });
    if (conn?.wabaId && conn.accessToken) {
      return {
        wabaId: conn.wabaId,
        token: conn.accessToken,
        version: this.version,
      };
    }
    const envWaba = process.env.WHATSAPP_WABA_ID;
    const envToken = process.env.WHATSAPP_TOKEN;
    if (envWaba && envToken) {
      return { wabaId: envWaba, token: envToken, version: this.version };
    }
    return null;
  }

  /**
   * Resuelve el id de la conexión (canal) a partir del phone_number_id que
   * Meta envía en el webhook. Devuelve null si es el del .env o no se conoce.
   */
  async resolveChannelId(phoneNumberId: string): Promise<string | null> {
    const conn = await this.prisma.whatsappConnection.findUnique({
      where: { phoneNumberId },
      select: { id: true },
    });
    return conn?.id ?? null;
  }

  // ── Listado de canales (multi-número) ────────────────────────
  async listChannels(): Promise<WhatsappChannel[]> {
    const rows = await this.prisma.whatsappConnection.findMany({
      orderBy: { connectedAt: "desc" },
    });
    const channels: WhatsappChannel[] = rows.map((c) => ({
      id: c.id,
      phoneNumberId: c.phoneNumberId,
      displayPhoneNumber: c.displayPhoneNumber,
      label: c.label,
      wabaId: c.wabaId,
      mode: c.mode,
      status: c.status,
      statusReason: c.statusReason,
      source: "embedded",
      isActive: c.isActive,
      connectedAt: c.connectedAt.toISOString(),
    }));

    // El número del .env aparece como canal extra si no está ya en la BD.
    const envPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const envToken = process.env.WHATSAPP_TOKEN;
    if (
      envPhone &&
      envToken &&
      !rows.some((r) => r.phoneNumberId === envPhone)
    ) {
      channels.push({
        statusReason: null,
        id: "env",
        phoneNumberId: envPhone,
        displayPhoneNumber: null,
        label: ".env",
        wabaId: null,
        mode: "api",
        status: "connected",
        source: "env",
        isActive: true,
        connectedAt: null,
      });
    }
    return channels;
  }

  // ── Estado agregado (compatibilidad) ─────────────────────────
  async status(): Promise<WhatsappConnectionStatus> {
    const conn = await this.prisma.whatsappConnection.findFirst({
      where: { isActive: true },
      orderBy: { connectedAt: "desc" },
    });
    if (conn) {
      return {
        connected: true,
        phoneNumberId: conn.phoneNumberId,
        displayPhoneNumber: conn.displayPhoneNumber,
        wabaId: conn.wabaId,
        mode: conn.mode,
        source: "embedded",
      };
    }
    const envToken = process.env.WHATSAPP_TOKEN;
    const envPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (envToken && envPhone) {
      return {
        connected: true,
        phoneNumberId: envPhone,
        displayPhoneNumber: null,
        wabaId: null,
        mode: "api",
        source: "env",
      };
    }
    return {
      connected: false,
      phoneNumberId: null,
      displayPhoneNumber: null,
      wabaId: null,
      mode: null,
      source: null,
    };
  }

  // ── Conectar un número (desde el Embedded Signup) ────────────
  async connect(input: ConnectWhatsappInput): Promise<WhatsappChannel[]> {
    const token = input.code
      ? await this.exchangeCode(input.code)
      : input.accessToken!;

    // Upsert por phoneNumberId: reconectar el mismo número actualiza su token
    // sin tocar a los demás canales (ya no se desactiva nada).
    await this.prisma.whatsappConnection.upsert({
      where: { phoneNumberId: input.phoneNumberId },
      create: {
        wabaId: input.wabaId ?? null,
        phoneNumberId: input.phoneNumberId,
        displayPhoneNumber: input.displayPhoneNumber ?? null,
        label: input.label ?? null,
        accessToken: token,
        mode: input.mode,
        isActive: true,
        status: "connected",
      },
      update: {
        wabaId: input.wabaId ?? undefined,
        displayPhoneNumber: input.displayPhoneNumber ?? undefined,
        label: input.label ?? undefined,
        accessToken: token,
        mode: input.mode,
        isActive: true,
        status: "connected",
        statusReason: null,
      },
    });
    this.logger.log(`WhatsApp conectado (${input.mode}) ${input.phoneNumberId}`);

    // Sin suscribir la app a la WABA, Meta no entrega los webhooks de ese número.
    if (input.wabaId) {
      const err = await this.graphPost(`${input.wabaId}/subscribed_apps`, token);
      if (err) {
        await this.markError(
          input.phoneNumberId,
          `No se pudo suscribir la app a los webhooks de la WABA: ${err}`,
        );
      }
    } else if (input.code) {
      await this.markError(
        input.phoneNumberId,
        "Meta no envió el waba_id, así que no se suscribió a los webhooks. Vuelve a conectar el número.",
      );
    }

    // Contactos e historial del celular: Meta solo acepta pedirlos en las 24 h
    // siguientes a conectar, y una sola vez (al reconectar fallan sin más).
    if (input.mode === "coexistence") {
      for (const syncType of ["smb_app_state_sync", "history"]) {
        const err = await this.graphPost(
          `${input.phoneNumberId}/smb_app_data`,
          token,
          { messaging_product: "whatsapp", sync_type: syncType },
        );
        if (err) {
          this.logger.warn(
            `Sincronización ${syncType} de ${input.phoneNumberId} falló: ${err}`,
          );
        }
      }
    }

    return this.listChannels();
  }

  /** POST a la Graph API. Devuelve el mensaje de error de Meta, o null si fue bien. */
  private async graphPost(
    path: string,
    token: string,
    body?: Record<string, unknown>,
  ): Promise<string | null> {
    try {
      const res = await fetch(`https://graph.facebook.com/${this.version}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) return null;
      const data = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      return data?.error?.message ?? `HTTP ${res.status}`;
    } catch (e) {
      return (e as Error).message.slice(0, 200);
    }
  }

  /**
   * Marca un canal como caído. Se llama cuando Meta rechaza el token
   * (OAuthException 190): sin esto el canal seguía figurando "conectado" y
   * los envíos fallaban en silencio, solo visibles en el log.
   */
  async markError(phoneNumberId: string, reason: string): Promise<void> {
    await this.prisma.whatsappConnection
      .updateMany({
        where: { phoneNumberId },
        data: { status: "error", statusReason: reason.slice(0, 300) },
      })
      .catch(() => undefined);
    this.logger.error(`Canal ${phoneNumberId} en error: ${reason}`);
  }

  /** Comprueba contra Meta que el token del canal sigue sirviendo. */
  async testChannel(phoneNumberId: string): Promise<ChannelTestResult> {
    const creds = await this.resolveCreds(phoneNumberId);
    if (!creds) {
      return {
        ok: false,
        message: "El canal no tiene credenciales configuradas.",
        displayPhoneNumber: null,
      };
    }
    try {
      const res = await fetch(
        `https://graph.facebook.com/${creds.version}/${creds.phoneNumberId}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${creds.token}` } },
      );
      const data = (await res.json()) as {
        display_phone_number?: string;
        verified_name?: string;
        error?: { message?: string; code?: number };
      };
      if (!res.ok || data.error) {
        const reason = data.error?.message ?? `HTTP ${res.status}`;
        await this.markError(phoneNumberId, reason);
        return { ok: false, message: reason, displayPhoneNumber: null };
      }
      // Funciona: si estaba marcado en error, se restablece.
      await this.prisma.whatsappConnection
        .updateMany({
          where: { phoneNumberId },
          data: { status: "connected", statusReason: null },
        })
        .catch(() => undefined);
      return {
        ok: true,
        message: `Token válido · ${data.verified_name ?? "sin nombre verificado"}`,
        displayPhoneNumber: data.display_phone_number ?? null,
      };
    } catch (e) {
      return {
        ok: false,
        message: (e as Error).message.slice(0, 200),
        displayPhoneNumber: null,
      };
    }
  }

  // ── Desconectar un número concreto ───────────────────────────
  async disconnect(phoneNumberId: string): Promise<WhatsappChannel[]> {
    await this.prisma.whatsappConnection.updateMany({
      where: { phoneNumberId },
      data: { isActive: false, status: "disconnected" },
    });
    this.logger.log(`WhatsApp desconectado ${phoneNumberId}`);
    return this.listChannels();
  }

  // Canjea el code del Embedded Signup por un token de acceso.
  private async exchangeCode(code: string): Promise<string> {
    // App ID y secret salen de Ajustes › Integraciones (respaldo en .env).
    const { appId, appSecret, graphVersion } = await this.settings.whatsappApp();
    if (!appId || !appSecret) {
      throw new BadRequestException(
        "Faltan el App ID o el App secret de Meta. Configúralos en Ajustes › Integraciones.",
      );
    }
    const url =
      `https://graph.facebook.com/${graphVersion}/oauth/access_token` +
      `?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Canje de code falló ${res.status}: ${err}`);
      throw new BadRequestException("No se pudo canjear el código de Meta");
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) {
      throw new BadRequestException("Meta no devolvió un access_token");
    }
    return data.access_token;
  }
}
