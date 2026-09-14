import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  CreateWebhookInput,
  CreatedWebhook,
  UpdateWebhookInput,
  WebhookEvent,
  WebhookSubscriptionDto,
  WebhookTestResult,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { QUEUE_WEBHOOK } from "../../infra/queue/queue.constants";

/** Lo que se encola por cada suscripción interesada en un evento. */
export interface WebhookJob {
  subscriptionId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  occurredAt: string;
}

@Injectable()
export class WebhookOutService {
  private readonly logger = new Logger("WebhooksOut");

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_WEBHOOK) private readonly queue: Queue,
  ) {}

  // ── Gestión ─────────────────────────────────────────────────
  async list(): Promise<WebhookSubscriptionDto[]> {
    const rows = await this.prisma.webhookSubscription.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(input: CreateWebhookInput): Promise<CreatedWebhook> {
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const row = await this.prisma.webhookSubscription.create({
      data: {
        name: input.name.trim(),
        url: input.url.trim(),
        events: input.events,
        secret,
      },
    });
    this.logger.log(`Webhook saliente creado: ${row.name} → ${row.url}`);
    return { subscription: this.toDto(row), secret };
  }

  async update(
    id: string,
    input: UpdateWebhookInput,
  ): Promise<WebhookSubscriptionDto> {
    await this.mustExist(id);
    const row = await this.prisma.webhookSubscription.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.url !== undefined ? { url: input.url.trim() } : {}),
        ...(input.events !== undefined ? { events: input.events } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return this.toDto(row);
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.mustExist(id);
    await this.prisma.webhookSubscription.delete({ where: { id } });
    return { ok: true };
  }

  /** Manda un evento de prueba para comprobar que el destino responde. */
  async test(id: string): Promise<WebhookTestResult> {
    const sub = await this.mustExist(id);
    const started = Date.now();
    try {
      const res = await this.deliver(sub, {
        subscriptionId: sub.id,
        event: "message.received",
        occurredAt: new Date().toISOString(),
        payload: {
          test: true,
          note: "Evento de prueba enviado desde Ajustes › Webhooks salientes.",
        },
      });
      return {
        ok: res.ok,
        status: res.status,
        message: res.ok
          ? `El destino respondió ${res.status}.`
          : `El destino respondió ${res.status}. Esperaba un 2xx.`,
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      return {
        ok: false,
        status: null,
        message: (e as Error).message.slice(0, 200),
        latencyMs: Date.now() - started,
      };
    }
  }

  // ── Emisión ─────────────────────────────────────────────────
  /**
   * Encola el evento para cada suscripción que lo escuche. No espera a que
   * se entregue: un webhook lento jamás debe frenar una respuesta del CRM.
   */
  async emit(
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const subs = await this.prisma.webhookSubscription.findMany({
        where: { isActive: true, events: { has: event } },
        select: { id: true },
      });
      if (!subs.length) return;

      const occurredAt = new Date().toISOString();
      await Promise.all(
        subs.map((s) =>
          this.queue.add("deliver", {
            subscriptionId: s.id,
            event,
            payload,
            occurredAt,
          } satisfies WebhookJob),
        ),
      );
    } catch (e) {
      // Emitir nunca debe romper la operación que lo originó.
      this.logger.warn(`No se pudo encolar ${event}: ${(e as Error).message}`);
    }
  }

  /** Entrega real. La invoca el procesador de la cola (y el botón de prueba). */
  async deliver(
    sub: { id: string; url: string; secret: string },
    job: WebhookJob,
  ): Promise<{ ok: boolean; status: number }> {
    const body = JSON.stringify({
      event: job.event,
      occurredAt: job.occurredAt,
      data: job.payload,
    });
    const signature = this.sign(body, sub.secret);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CRM-Event": job.event,
          "X-CRM-Signature": signature,
          "User-Agent": "crm-prime-webhooks/1",
        },
        body,
        signal: controller.signal,
      });
      await this.record(sub.id, res.status, res.ok ? null : await this.snippet(res));
      return { ok: res.ok, status: res.status };
    } finally {
      clearTimeout(timeout);
    }
  }

  /** `sha256=<hex>` sobre el cuerpo exacto, igual que hace Meta. */
  sign(body: string, secret: string): string {
    return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  }

  /** Para quien implemente el receptor: comparación en tiempo constante. */
  verify(body: string, secret: string, received: string): boolean {
    const a = Buffer.from(this.sign(body, secret));
    const b = Buffer.from(received);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async findSubscription(id: string) {
    return this.prisma.webhookSubscription.findUnique({ where: { id } });
  }

  async recordFailure(id: string, error: string): Promise<void> {
    await this.record(id, null, error);
  }

  // ── Internos ────────────────────────────────────────────────
  private async record(
    id: string,
    status: number | null,
    error: string | null,
  ): Promise<void> {
    const ok = status !== null && status >= 200 && status < 300;
    await this.prisma.webhookSubscription
      .update({
        where: { id },
        data: {
          lastStatus: status,
          lastError: error?.slice(0, 300) ?? null,
          lastDeliveryAt: new Date(),
          ...(ok
            ? { deliveredCount: { increment: 1 } }
            : { failedCount: { increment: 1 } }),
        },
      })
      .catch(() => undefined);
  }

  private async snippet(res: Response): Promise<string> {
    return (await res.text().catch(() => "")).slice(0, 200);
  }

  private async mustExist(id: string) {
    const row = await this.prisma.webhookSubscription.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException("Webhook no encontrado");
    return row;
  }

  private toDto(r: {
    id: string;
    name: string;
    url: string;
    events: string[];
    isActive: boolean;
    lastStatus: number | null;
    lastError: string | null;
    lastDeliveryAt: Date | null;
    deliveredCount: number;
    failedCount: number;
    createdAt: Date;
  }): WebhookSubscriptionDto {
    return {
      id: r.id,
      name: r.name,
      url: r.url,
      events: r.events as WebhookEvent[],
      isActive: r.isActive,
      lastStatus: r.lastStatus,
      lastError: r.lastError,
      lastDeliveryAt: r.lastDeliveryAt?.toISOString() ?? null,
      deliveredCount: r.deliveredCount,
      failedCount: r.failedCount,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
