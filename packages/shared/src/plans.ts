import { z } from "zod";

/**
 * Planes del SaaS.
 *
 * El plan de cada empresa es una cadena en `Organization.plan`; este catálogo
 * dice qué significa. Vive en código y no en la base a propósito: hay tres
 * planes, cambian poco, y así la API, la web y la consola hablan de los mismos
 * límites sin sincronizar nada.
 *
 * No hay cobro automático todavía: el plan lo cambia el operador desde la
 * consola de plataforma. Los precios son informativos y se cambian aquí.
 *
 * En una instalación propia (TENANCY_MODE=single) no hay planes: todo es
 * ilimitado, ver SELF_HOSTED_PLAN.
 */
export const PLAN_KEYS = ["free", "pro", "business"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export const planKeySchema = z.enum(PLAN_KEYS);

export const PLAN_FEATURES = ["coexistence", "broadcasts", "api", "prioritySupport"] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  coexistence: "Coexistencia con el celular",
  broadcasts: "Difusiones con plantillas",
  api: "API pública y webhooks",
  prioritySupport: "Soporte prioritario",
};

export const planDefSchema = z.object({
  key: z.string(),
  name: z.string(),
  tagline: z.string(),
  /** USD al mes. null = sin precio (instalación propia). */
  priceUsd: z.number().nullable(),
  /** null = sin límite. */
  limits: z.object({
    numbers: z.number().nullable(),
    users: z.number().nullable(),
  }),
  features: z.object({
    coexistence: z.boolean(),
    broadcasts: z.boolean(),
    api: z.boolean(),
    prioritySupport: z.boolean(),
  }),
});
export type PlanDef = z.infer<typeof planDefSchema>;

export const PLANS: Record<PlanKey, PlanDef> = {
  free: {
    key: "free",
    name: "Gratis",
    tagline: "Para probar Driony con un número y el agente de IA.",
    priceUsd: 0,
    limits: { numbers: 1, users: 2 },
    features: { coexistence: false, broadcasts: false, api: false, prioritySupport: false },
  },
  pro: {
    key: "pro",
    name: "Pro",
    tagline: "Para equipos que venden por WhatsApp todos los días.",
    priceUsd: 49,
    limits: { numbers: 3, users: 10 },
    features: { coexistence: true, broadcasts: true, api: true, prioritySupport: false },
  },
  business: {
    key: "business",
    name: "Empresa",
    tagline: "Varios números, equipo grande y soporte prioritario.",
    priceUsd: 149,
    limits: { numbers: null, users: null },
    features: { coexistence: true, broadcasts: true, api: true, prioritySupport: true },
  },
};

/** Instalación propia: sin límites ni planes. */
export const SELF_HOSTED_PLAN: PlanDef = {
  key: "selfhosted",
  name: "Instalación propia",
  tagline: "Tu servidor, tus claves, sin límites.",
  priceUsd: null,
  limits: { numbers: null, users: null },
  features: { coexistence: true, broadcasts: true, api: true, prioritySupport: false },
};

/** El plan que corresponde a una clave guardada; lo desconocido cae en Gratis. */
export function planFor(key: string | null | undefined): PlanDef {
  return (PLAN_KEYS as readonly string[]).includes(key ?? "") ? PLANS[key as PlanKey] : PLANS.free;
}

/** El plan más barato que incluye una característica, o null si ninguno. */
export function planWithFeature(feature: PlanFeature): PlanDef | null {
  return PLAN_KEYS.map((k) => PLANS[k]).find((p) => p.features[feature]) ?? null;
}

/** "USD 49/mes", "Sin costo" o "" (sin precio). */
export function formatPlanPrice(plan: PlanDef): string {
  if (plan.priceUsd === null) return "";
  if (plan.priceUsd === 0) return "Sin costo";
  return `USD ${plan.priceUsd}/mes`;
}
