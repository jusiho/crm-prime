import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  FEATURE_LABELS,
  PLAN_KEYS,
  PLANS,
  SELF_HOSTED_PLAN,
  planFor,
  planWithFeature,
  type MyPlanDto,
  type PlanDef,
  type PlanFeature,
} from "@crm/shared";
import { env } from "../../common/utils/env";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TenantService } from "../../infra/tenant/tenant.service";
import { tenancyMode } from "../../infra/tenant/tenant.context";

/**
 * El plan de la empresa en curso y lo que permite.
 *
 * Los límites se comprueban al AÑADIR (otro número, otro usuario), nunca sobre
 * lo que ya existe: bajar de plan no desconecta nada ni echa a nadie. Las
 * características (coexistencia, difusiones, API) se comprueban al usarlas.
 *
 * En instalación propia no hay planes: todo pasa.
 */
@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  get saas(): boolean {
    return tenancyMode === "multi";
  }

  async current(): Promise<PlanDef> {
    if (!this.saas) return SELF_HOSTED_PLAN;
    const org = await this.prisma.organization.findUnique({
      where: { id: this.tenant.orgId() },
      select: { plan: true },
    });
    return planFor(org?.plan);
  }

  async usage(): Promise<{ numbers: number; users: number }> {
    const [numbers, users] = await Promise.all([
      this.prisma.whatsappConnection.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: true } }),
    ]);
    return { numbers, users };
  }

  async mine(): Promise<MyPlanDto> {
    const [plan, usage] = await Promise.all([this.current(), this.usage()]);
    return {
      saas: this.saas,
      plan,
      usage,
      plans: this.saas ? PLAN_KEYS.map((k) => PLANS[k]) : [],
      contactEmail: env("NEXT_PUBLIC_CONTACT_EMAIL") ?? env("CONTACT_EMAIL") ?? null,
    };
  }

  /** La característica está en el plan, o 403 con qué plan la incluye. */
  async assertFeature(feature: PlanFeature): Promise<void> {
    const plan = await this.current();
    if (plan.features[feature]) return;
    const needed = planWithFeature(feature);
    throw new ForbiddenException(
      `${FEATURE_LABELS[feature]} no está en tu plan ${plan.name}` +
        (needed ? `: está disponible a partir del plan ${needed.name}` : "") +
        ". Puedes cambiarlo desde Ajustes › Plan.",
    );
  }

  /** Cabe uno más, o 403 con el límite del plan. */
  async assertCanAdd(kind: "numbers" | "users"): Promise<void> {
    const plan = await this.current();
    const limit = plan.limits[kind];
    if (limit === null) return;
    const used = (await this.usage())[kind];
    if (used < limit) return;
    const que =
      kind === "numbers"
        ? limit === 1 ? "número de WhatsApp" : "números de WhatsApp"
        : limit === 1 ? "usuario" : "usuarios";
    throw new ForbiddenException(
      `Tu plan ${plan.name} admite ${limit} ${que}. Para añadir más, cambia de plan desde Ajustes › Plan.`,
    );
  }
}
