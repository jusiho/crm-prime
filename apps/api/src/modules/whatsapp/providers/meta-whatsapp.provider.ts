import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  DownloadedMedia,
  SendResult,
  WhatsAppProvider,
} from "../whatsapp-provider.interface";
import {
  WhatsappConnectionService,
  type WhatsappCreds,
} from "../whatsapp-connection.service";
import {
  STORAGE_PROVIDER,
  toStorageRef,
  type StorageProvider,
} from "../../../infra/storage/storage.provider";

/**
 * Adaptador de la WhatsApp Business Cloud API (Meta).
 * Resuelve las credenciales en cada envío desde la conexión activa
 * (Embedded Signup en BD) o, en su defecto, del .env. Si no hay credenciales,
 * funciona en modo simulado (registra en log y devuelve un id sintético),
 * así el CRM nunca se rompe por no estar conectado todavía.
 */
@Injectable()
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = "meta";
  private readonly logger = new Logger("WhatsApp");

  constructor(
    private readonly connection: WhatsappConnectionService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async sendText(
    to: string,
    text: string,
    fromPhoneNumberId?: string,
    replyToWaMessageId?: string,
  ): Promise<SendResult> {
    const creds = await this.connection.resolveCreds(fromPhoneNumberId);
    if (!creds) return this.simulate("text", to, text);
    return this.post(creds, {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
      // `context` es lo que hace que WhatsApp pinte la cita en el móvil.
      ...(replyToWaMessageId
        ? { context: { message_id: replyToWaMessageId } }
        : {}),
    });
  }

  async sendMedia(
    to: string,
    kind: "IMAGE" | "DOCUMENT",
    mediaUrl: string,
    caption?: string,
    fromPhoneNumberId?: string,
  ): Promise<SendResult> {
    const creds = await this.connection.resolveCreds(fromPhoneNumberId);
    if (!creds) return this.simulate(kind, to, mediaUrl);
    const key = kind === "IMAGE" ? "image" : "document";
    return this.post(creds, {
      messaging_product: "whatsapp",
      to,
      type: key,
      [key]: { link: mediaUrl, ...(caption ? { caption } : {}) },
    });
  }

  async sendTemplate(
    to: string,
    templateName: string,
    language: string,
    variables: string[],
    fromPhoneNumberId?: string,
  ): Promise<SendResult> {
    const creds = await this.connection.resolveCreds(fromPhoneNumberId);
    if (!creds) return this.simulate("template", to, templateName);
    const components = variables.length
      ? [
          {
            type: "body",
            parameters: variables.map((v) => ({ type: "text", text: v })),
          },
        ]
      : [];
    return this.post(creds, {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        ...(components.length ? { components } : {}),
      },
    });
  }

  async sendReaction(
    to: string,
    targetWaMessageId: string,
    emoji: string,
    fromPhoneNumberId?: string,
  ): Promise<SendResult> {
    const creds = await this.connection.resolveCreds(fromPhoneNumberId);
    if (!creds) return this.simulate("reaction", to, emoji);
    return this.post(creds, {
      messaging_product: "whatsapp",
      to,
      type: "reaction",
      reaction: { message_id: targetWaMessageId, emoji },
    });
  }

  /**
   * Marca como leído + "escribiendo…". Comparte endpoint con los envíos pero
   * NO devuelve waMessageId (responde {"success":true}), por eso no reutiliza
   * `post`. Un fallo aquí es cosmético: nunca debe tumbar la respuesta.
   * https://developers.facebook.com/docs/whatsapp/cloud-api/typing-indicators/
   */
  async sendTypingIndicator(
    waMessageId: string,
    fromPhoneNumberId?: string,
  ): Promise<void> {
    const creds = await this.connection.resolveCreds(fromPhoneNumberId);
    if (!creds) return;
    try {
      const res = await fetch(
        `https://graph.facebook.com/${creds.version}/${creds.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${creds.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            status: "read",
            message_id: waMessageId,
            typing_indicator: { type: "text" },
          }),
        },
      );
      if (!res.ok) {
        this.logger.warn(
          `Indicador de escritura ${res.status}: ${(await res.text()).slice(0, 160)}`,
        );
      }
    } catch (e) {
      this.logger.warn(`Indicador de escritura falló: ${(e as Error).message}`);
    }
  }

  async downloadMedia(
    mediaId: string,
    fromPhoneNumberId?: string,
  ): Promise<DownloadedMedia> {
    const creds = await this.connection.resolveCreds(fromPhoneNumberId);
    if (!creds) {
      return {
        url: `https://example.invalid/media/${mediaId}`,
        mimeType: "application/octet-stream",
      };
    }
    // Dos pasos: primero los metadatos (que traen una URL temporal), y luego
    // el binario. Esa URL exige el token y caduca, así que no sirve para
    // guardarla: hay que descargar y almacenar el contenido.
    const res = await fetch(
      `https://graph.facebook.com/${creds.version}/${mediaId}`,
      { headers: { Authorization: `Bearer ${creds.token}` } },
    );
    if (!res.ok) throw new Error(`Meta media lookup ${res.status}`);
    const meta = (await res.json()) as { url: string; mime_type: string };

    const bin = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${creds.token}` },
    });
    if (!bin.ok) throw new Error(`Meta media download ${bin.status}`);
    const buffer = Buffer.from(await bin.arrayBuffer());

    const stored = await this.storage.save(buffer, meta.mime_type, mediaId);
    return { url: toStorageRef(stored.id), mimeType: stored.mimeType };
  }

  async uploadMedia(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    fromPhoneNumberId?: string,
  ): Promise<string> {
    const creds = await this.connection.resolveCreds(fromPhoneNumberId);
    if (!creds) return `simulated-media-${Date.now()}`;

    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mimeType);
    form.append("file", new Blob([buffer], { type: mimeType }), filename);

    const res = await fetch(
      `https://graph.facebook.com/${creds.version}/${creds.phoneNumberId}/media`,
      {
        method: "POST",
        // Sin Content-Type: fetch pone el boundary del multipart por su cuenta.
        headers: { Authorization: `Bearer ${creds.token}` },
        body: form,
      },
    );
    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Subida de medio ${res.status}: ${err.slice(0, 200)}`);
      throw new Error(`No se pudo subir el archivo a WhatsApp (${res.status})`);
    }
    const data = (await res.json()) as { id?: string };
    if (!data.id) throw new Error("Meta no devolvió el id del medio");
    return data.id;
  }

  async sendMediaById(
    to: string,
    kind: "IMAGE" | "DOCUMENT",
    mediaId: string,
    caption?: string,
    fromPhoneNumberId?: string,
  ): Promise<SendResult> {
    const creds = await this.connection.resolveCreds(fromPhoneNumberId);
    if (!creds) return this.simulate(kind, to, mediaId);
    const key = kind === "IMAGE" ? "image" : "document";
    return this.post(creds, {
      messaging_product: "whatsapp",
      to,
      type: key,
      [key]: { id: mediaId, ...(caption ? { caption } : {}) },
    });
  }

  private async post(
    creds: WhatsappCreds,
    body: unknown,
  ): Promise<SendResult> {
    const res = await fetch(
      `https://graph.facebook.com/${creds.version}/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Meta send ${res.status}: ${err}`);
      // OAuthException 190 = token inválido o caducado. Se marca el canal
      // para que la UI lo muestre en rojo en vez de seguir diciendo que
      // está conectado mientras nada sale.
      if (this.isAuthError(res.status, err)) {
        await this.connection.markError(
          creds.phoneNumberId,
          "Token caducado o inválido. Vuelve a conectar el número.",
        );
      }
      throw new Error(`Meta send failed ${res.status}`);
    }
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { waMessageId: data.messages?.[0]?.id ?? "" };
  }

  // Meta devuelve 401 con code 190 cuando el token murió.
  private isAuthError(status: number, body: string): boolean {
    if (status !== 401 && status !== 403) return false;
    try {
      const parsed = JSON.parse(body) as { error?: { code?: number } };
      return parsed.error?.code === 190;
    } catch {
      return true; // 401 sin cuerpo legible: se asume problema de auth
    }
  }

  private simulate(kind: string, to: string, body: string): SendResult {
    const waMessageId = `wamid.sim.${randomUUID()}`;
    this.logger.warn(
      `[sin conexión WhatsApp] → [${kind}] a ${to}: "${body}" (${waMessageId})`,
    );
    return { waMessageId };
  }
}
