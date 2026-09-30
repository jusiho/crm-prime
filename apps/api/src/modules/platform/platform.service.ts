import { Injectable, NotFoundException } from "@nestjs/common";
import type { PlatformOrg, PlatformOverview, UpdatePlatformOrgInput } from "@crm/shared";
import { env } from "../../common/utils/env";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { runUnscoped } from "../../infra/tenant/tenant.context";

/**
 * Cifras de toda la plataforma para su operador.
 *
 * Es el único sitio de la aplicación que lee todas las empresas a la vez, y
 * por eso va con `runUnscoped` en cada consulta y detrás de PlatformAdminGuard.
 * Son consultas de agregación en SQL: contar por empresa con el cliente de
 * Prisma serían decenas de viajes por fila.
 */
@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<PlatformOverview> {
    return runUnscoped("consola de plataforma: cifras globales", async () => {
      const [totals] = await this.prisma.$queryRaw<
        Array<Record<string, bigint | number | string | null>>
      >`
        SELECT
          (SELECT count(*) FROM organizations)                                                   AS orgs,
          (SELECT count(*) FROM organizations WHERE "isActive")                                  AS active_orgs,
          (SELECT count(*) FROM organizations WHERE "createdAt" >= now() - interval '7 days')     AS new7,
          (SELECT count(*) FROM organizations WHERE "createdAt" >= now() - interval '30 days')    AS new30,
          (SELECT count(DISTINCT "orgId") FROM messages WHERE "createdAt" >= now() - interval '7 days') AS orgs_active7,
          (SELECT count(*) FROM users WHERE "isActive")                                          AS users,
          (SELECT count(*) FROM whatsapp_connections WHERE "isActive")                           AS numbers,
          (SELECT count(*) FROM whatsapp_connections WHERE "isActive" AND mode = 'coexistence')  AS coexistence,
          (SELECT count(*) FROM messages WHERE "createdAt" >= now() - interval '7 days')          AS messages7,
          (SELECT coalesce(sum("costUsd"), 0) FROM ai_runs WHERE "createdAt" >= date_trunc('month', now())) AS ai_cost
      `;
      const days = await this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt")::date AS day, count(*) AS count
        FROM organizations
        WHERE "createdAt" >= now() - interval '30 days'
        GROUP BY 1 ORDER BY 1
      `;
      const plans = await this.prisma.$queryRaw<Array<{ plan: string; count: bigint }>>`
        SELECT plan, count(*) AS count FROM organizations GROUP BY plan ORDER BY count DESC
      `;
      const n = (v: unknown) => Number(v ?? 0);
      return {
        orgs: n(totals?.orgs),
        activeOrgs: n(totals?.active_orgs),
        new7d: n(totals?.new7),
        new30d: n(totals?.new30),
        orgsActive7d: n(totals?.orgs_active7),
        users: n(totals?.users),
        numbers: n(totals?.numbers),
        coexistenceNumbers: n(totals?.coexistence),
        messages7d: n(totals?.messages7),
        aiCostMonthUsd: n(totals?.ai_cost),
        signupsByDay: days.map((d) => ({ day: toDay(d.day), count: n(d.count) })),
        byPlan: plans.map((p) => ({ plan: p.plan, count: n(p.count) })),
      };
    });
  }

  async orgs(search = ""): Promise<PlatformOrg[]> {
    const q = search.trim();
    const base = env("SAAS_BASE_DOMAIN") ?? "localhost:3000";
    const protocolo = base.startsWith("localhost") ? "http" : "https";
    return runUnscoped("consola de plataforma: listado de empresas", async () => {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          slug: string;
          name: string;
          plan: string;
          isActive: boolean;
          createdAt: Date;
          admin_email: string | null;
          users: bigint;
          numbers: bigint;
          coexistence: bigint;
          contacts: bigint;
          messages30: bigint;
          last_message_at: Date | null;
          ai_cost: unknown;
          onboarding_completed_at: Date | null;
        }>
      >`
        SELECT o.id, o.slug, o.name, o.plan, o."isActive", o."createdAt",
          (SELECT u.email FROM users u WHERE u."orgId" = o.id AND u.role = 'ADMIN' ORDER BY u."createdAt" LIMIT 1) AS admin_email,
          (SELECT count(*) FROM users u WHERE u."orgId" = o.id AND u."isActive")                        AS users,
          (SELECT count(*) FROM whatsapp_connections w WHERE w."orgId" = o.id AND w."isActive")         AS numbers,
          (SELECT count(*) FROM whatsapp_connections w WHERE w."orgId" = o.id AND w."isActive" AND w.mode = 'coexistence') AS coexistence,
          (SELECT count(*) FROM contacts c WHERE c."orgId" = o.id)                                      AS contacts,
          (SELECT count(*) FROM messages m WHERE m."orgId" = o.id AND m."createdAt" >= now() - interval '30 days') AS messages30,
          (SELECT max(m."createdAt") FROM messages m WHERE m."orgId" = o.id)                            AS last_message_at,
          (SELECT coalesce(sum(r."costUsd"), 0) FROM ai_runs r JOIN conversations c ON c.id = r."conversationId"
             WHERE c."orgId" = o.id AND r."createdAt" >= date_trunc('month', now()))                   AS ai_cost,
          (SELECT s."completedAt" FROM onboarding_states s WHERE s."orgId" = o.id)                     AS onboarding_completed_at
        FROM organizations o
        WHERE ${q} = '' OR o.name ILIKE ${"%" + q + "%"} OR o.slug ILIKE ${"%" + q + "%"}
        ORDER BY o."createdAt" DESC
        LIMIT 500
      `;
      return rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        url: `${protocolo}://${r.slug}.${base}`,
        plan: r.plan,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
        adminEmail: r.admin_email,
        users: Number(r.users),
        numbers: Number(r.numbers),
        coexistenceNumbers: Number(r.coexistence),
        contacts: Number(r.contacts),
        messages30d: Number(r.messages30),
        lastMessageAt: r.last_message_at?.toISOString() ?? null,
        aiCostMonthUsd: Number(r.ai_cost ?? 0),
        onboardingCompletedAt: r.onboarding_completed_at?.toISOString() ?? null,
      }));
    });
  }

  /** Cambiar de plan o suspender/reactivar. `organizations` no lleva RLS. */
  async update(id: string, input: UpdatePlatformOrgInput): Promise<PlatformOrg> {
    const org = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!org) throw new NotFoundException("Empresa no encontrada");
    await this.prisma.organization.update({
      where: { id },
      data: {
        ...(input.plan !== undefined ? { plan: input.plan } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    const [row] = (await this.orgs()).filter((o) => o.id === id);
    if (!row) throw new NotFoundException("Empresa no encontrada");
    return row;
  }
}

function toDay(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}
