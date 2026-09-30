import { z } from "zod";
import { planDefSchema, planKeySchema } from "../plans.js";

// ── Lo que ve cada empresa de su plan (Ajustes › Plan) ────────

export const myPlanSchema = z.object({
  /** false = instalación propia: no hay planes ni límites. */
  saas: z.boolean(),
  plan: planDefSchema,
  usage: z.object({ numbers: z.number(), users: z.number() }),
  /** El catálogo completo, para comparar. Vacío en instalación propia. */
  plans: z.array(planDefSchema),
  /** A quién escribir para cambiar de plan (no hay cobro automático). */
  contactEmail: z.string().nullable(),
});
export type MyPlanDto = z.infer<typeof myPlanSchema>;

// ── Consola de plataforma (solo el operador del SaaS) ─────────

export const platformOverviewSchema = z.object({
  orgs: z.number(),
  activeOrgs: z.number(),
  new7d: z.number(),
  new30d: z.number(),
  /** Empresas con mensajes en los últimos 7 días. */
  orgsActive7d: z.number(),
  users: z.number(),
  numbers: z.number(),
  coexistenceNumbers: z.number(),
  messages7d: z.number(),
  aiCostMonthUsd: z.number(),
  signupsByDay: z.array(z.object({ day: z.string(), count: z.number() })),
  byPlan: z.array(z.object({ plan: z.string(), count: z.number() })),
});
export type PlatformOverview = z.infer<typeof platformOverviewSchema>;

export const platformOrgSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  url: z.string(),
  plan: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  adminEmail: z.string().nullable(),
  users: z.number(),
  numbers: z.number(),
  coexistenceNumbers: z.number(),
  contacts: z.number(),
  messages30d: z.number(),
  lastMessageAt: z.string().nullable(),
  aiCostMonthUsd: z.number(),
  onboardingCompletedAt: z.string().nullable(),
});
export type PlatformOrg = z.infer<typeof platformOrgSchema>;

export const updatePlatformOrgSchema = z.object({
  plan: planKeySchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePlatformOrgInput = z.infer<typeof updatePlatformOrgSchema>;
