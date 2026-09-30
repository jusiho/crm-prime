import { Injectable, Logger } from "@nestjs/common";
import {
  AI_FEATURE_LABELS,
  AI_PRICES_REVIEWED,
  estimateAiCost,
  type AiFeature,
  type AiUsagePeriod,
  type AiUsageReport,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { currentOrgId } from "../../infra/tenant/tenant.context";
import { TenantService } from "../../infra/tenant/tenant.service";

export interface UsageEvent {
  feature: AiFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  conversationId?: string | null;
}

/**
 * Registro y lectura del consumo de IA de cada empresa.
 *
 * Se registra en un solo sitio por tipo de llamada (el enrutador de modelos,
 * la clasificación y los embeddings), así ninguna función nueva se queda sin
 * contar por olvido. El registro nunca bloquea ni hace fallar la llamada.
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger("AiUsage");

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  record(e: UsageEvent): void {
    const orgId = currentOrgId();
    if (!orgId || /^fake/i.test(e.model) || (e.inputTokens <= 0 && e.outputTokens <= 0)) return;
    void this.prisma.aiUsage
      .create({
        data: {
          orgId,
          feature: e.feature,
          model: e.model,
          inputTokens: Math.max(0, Math.round(e.inputTokens)),
          outputTokens: Math.max(0, Math.round(e.outputTokens)),
          conversationId: e.conversationId ?? null,
        },
      })
      .catch((err: Error) => this.logger.warn(`No se pudo registrar el consumo: ${err.message}`));
  }

  async report(period: AiUsagePeriod): Promise<AiUsageReport> {
    const { from, to } = range(period);
    const orgId = this.tenant.orgId();

    // Agrupado en la base: por función y modelo, y por día y modelo (el
    // precio depende del modelo, así que el coste se calcula aquí después).
    const byFM = await this.prisma.aiUsage.groupBy({
      by: ["feature", "model"],
      where: { createdAt: { gte: from, lt: to } },
      _sum: { inputTokens: true, outputTokens: true },
      _count: { _all: true },
    });
    const days = await this.prisma.$queryRaw<Array<{ day: Date; model: string; input: bigint; output: bigint }>>`
      SELECT date_trunc('day', "createdAt")::date AS day, model,
             sum("inputTokens")::bigint AS input, sum("outputTokens")::bigint AS output
      FROM ai_usage
      WHERE "orgId" = ${orgId} AND "createdAt" >= ${from} AND "createdAt" < ${to}
      GROUP BY 1, 2 ORDER BY 1
    `;

    const empty = () => ({ calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, unpriced: false });
    const total = empty();
    const features = new Map<string, ReturnType<typeof empty>>();
    const models = new Map<string, ReturnType<typeof empty> & { priced: boolean }>();

    for (const r of byFM) {
      const input = r._sum.inputTokens ?? 0;
      const output = r._sum.outputTokens ?? 0;
      const calls = r._count._all;
      const cost = estimateAiCost(r.model, input, output);
      for (const acc of [
        total,
        features.get(r.feature) ?? features.set(r.feature, empty()).get(r.feature)!,
        models.get(r.model) ?? models.set(r.model, { ...empty(), priced: cost !== null }).get(r.model)!,
      ]) {
        acc.calls += calls;
        acc.inputTokens += input;
        acc.outputTokens += output;
        if (cost === null) acc.unpriced = true;
        else acc.costUsd += cost;
      }
    }

    const dayMap = new Map<string, { tokens: number; costUsd: number }>();
    for (const d of days) {
      const key = (d.day instanceof Date ? d.day.toISOString() : String(d.day)).slice(0, 10);
      const cur = dayMap.get(key) ?? { tokens: 0, costUsd: 0 };
      const input = Number(d.input);
      const output = Number(d.output);
      cur.tokens += input + output;
      cur.costUsd += estimateAiCost(d.model, input, output) ?? 0;
      dayMap.set(key, cur);
    }
    const byDay: AiUsageReport["byDay"] = [];
    for (let t = startOfDay(from).getTime(); t < to.getTime(); t += 86_400_000) {
      const key = new Date(t).toISOString().slice(0, 10);
      byDay.push({ day: key, ...(dayMap.get(key) ?? { tokens: 0, costUsd: 0 }) });
    }

    return {
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      total,
      byFeature: [...features.entries()]
        .map(([feature, v]) => ({ feature, label: AI_FEATURE_LABELS[feature as AiFeature] ?? feature, ...v }))
        .sort((a, b) => b.costUsd - a.costUsd || b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens)),
      byModel: [...models.entries()]
        .map(([model, v]) => ({ model, ...v }))
        .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens)),
      byDay,
      pricesReviewed: AI_PRICES_REVIEWED,
    };
  }
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function range(period: AiUsagePeriod): { from: Date; to: Date } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (period === "last_month") {
    return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), to: monthStart };
  }
  if (period === "30d") {
    return { from: startOfDay(new Date(now.getTime() - 29 * 86_400_000)), to: new Date(now.getTime() + 1000) };
  }
  return { from: monthStart, to: new Date(now.getTime() + 1000) };
}
