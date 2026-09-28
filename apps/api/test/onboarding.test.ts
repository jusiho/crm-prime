/**
 * Primeros pasos: el estado de cada paso se deduce de los datos, y solo lo
 * que no se puede deducir (omitidos, marcados por el sistema, oculto) se
 * guarda. Aquí se prueba esa lógica con una base de datos simulada.
 *
 *   npm run test:onboarding --workspace=apps/api
 */
import test from "node:test";
import assert from "node:assert/strict";
import { OnboardingService } from "../src/modules/onboarding/onboarding.service";
import { PROMPT_POR_DEFECTO } from "../src/modules/organizations/default-prompt";

interface Fake {
  whatsapp: number;
  products: number;
  knowledge: number;
  conversations: number;
  users: number;
  agents: { systemPrompt: string; isDefault: boolean; welcomeEnabled: boolean; name: string }[];
  aiSetting: { openaiKeyEnc: string | null; anthropicKeyEnc: string | null } | null;
  state: { skipped: string[]; done: string[]; dismissedAt: Date | null; completedAt: Date | null } | null;
  toursSeen: string[];
}

function service(f: Fake) {
  const upserts: unknown[] = [];
  const prisma = {
    organization: { findUniqueOrThrow: async () => ({ createdAt: new Date("2026-09-01") }) },
    onboardingState: {
      findUnique: async () => f.state,
      upsert: async (args: unknown) => {
        upserts.push(args);
        return null;
      },
    },
    user: {
      findUnique: async () => ({ toursSeen: f.toursSeen }),
      count: async () => f.users,
      update: async (args: { data: { toursSeen: string[] } }) => {
        f.toursSeen = args.data.toursSeen;
        return null;
      },
    },
    whatsappConnection: { count: async () => f.whatsapp },
    aiSetting: { findFirst: async () => f.aiSetting },
    agentConfig: { findMany: async () => f.agents },
    product: { count: async () => f.products },
    knowledgeDoc: { count: async () => f.knowledge },
    conversation: { count: async () => f.conversations },
  };
  const tenant = { orgId: () => "org_1" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { svc: new OnboardingService(prisma as any, tenant as any), upserts };
}

const fresh = (): Fake => ({
  whatsapp: 0,
  products: 0,
  knowledge: 0,
  conversations: 0,
  users: 1,
  agents: [{ systemPrompt: PROMPT_POR_DEFECTO, isDefault: true, welcomeEnabled: false, name: "Agente por defecto" }],
  aiSetting: null,
  state: null,
  toursSeen: [],
});

test("una empresa recién creada tiene todo pendiente salvo lo que da la plataforma", async () => {
  const { svc } = service(fresh());
  const s = await svc.status("u1");
  const by = Object.fromEntries(s.steps.map((x) => [x.key, x.status]));
  assert.equal(by.whatsapp, "pending");
  assert.equal(by.agent, "pending", "el prompt por defecto no cuenta como personalizado");
  assert.equal(by.products, "pending");
  assert.equal(by.knowledge, "pending");
  assert.equal(by.try_agent, "pending");
  assert.equal(by.first_chat, "pending");
  assert.equal(by.team, "pending", "un solo usuario no es un equipo");
  assert.equal(s.total, 8);
  assert.equal(s.completedAt, null);
  assert.equal(s.dismissedAt, null);
});

test("los pasos se marcan solos con los datos, y el orden es el del camino al valor", async () => {
  const f = fresh();
  f.whatsapp = 1;
  f.products = 12;
  f.agents[0]!.systemPrompt = "Eres Trimmo Bot, vendes cursos de música…";
  f.conversations = 3;
  f.users = 2;
  const { svc } = service(f);
  const s = await svc.status("u1");
  assert.deepEqual(
    s.steps.map((x) => `${x.key}:${x.status}${x.count !== null ? `(${x.count})` : ""}`),
    [
      "whatsapp:done(1)",
      `ai:${s.steps[1]!.status}`,
      "agent:done",
      "products:done(12)",
      "knowledge:pending(0)",
      "try_agent:pending",
      "first_chat:done(3)",
      "team:done(2)",
    ],
  );
});

test("activar el saludo o crear otro bot también cuenta como agente personalizado", async () => {
  const f = fresh();
  f.agents[0]!.welcomeEnabled = true;
  assert.equal((await service(f).svc.status("u1")).steps.find((x) => x.key === "agent")?.status, "done");
  const g = fresh();
  g.agents.push({ systemPrompt: "otro", isDefault: false, welcomeEnabled: false, name: "Ventas" });
  assert.equal((await service(g).svc.status("u1")).steps.find((x) => x.key === "agent")?.status, "done");
});

test("omitidos y marcados por el sistema cuentan como hechos; al completar se registra la fecha", async () => {
  const f = fresh();
  f.whatsapp = 1;
  f.products = 1;
  f.knowledge = 1;
  f.conversations = 1;
  f.users = 2;
  f.aiSetting = { openaiKeyEnc: "enc", anthropicKeyEnc: null };
  f.agents[0]!.systemPrompt = "personalizado";
  f.state = { skipped: ["team"], done: ["try_agent"], dismissedAt: null, completedAt: null };
  const { svc, upserts } = service(f);
  const s = await svc.status("u1");
  assert.equal(s.steps.find((x) => x.key === "try_agent")?.status, "done");
  assert.equal(s.done, s.total);
  assert.ok(s.completedAt, "se registra cuándo quedó lista");
  assert.equal(upserts.length, 1, "y se guarda una sola vez");
});

test("un paso omitido vuelve a pendiente al retomarlo", async () => {
  const f = fresh();
  f.state = { skipped: ["team"], done: [], dismissedAt: null, completedAt: null };
  const { svc, upserts } = service(f);
  assert.equal((await svc.status("u1")).steps.find((x) => x.key === "team")?.status, "skipped");
  await svc.skip("team", false);
  const saved = upserts.at(-1) as { update: { skipped: string[] } };
  assert.deepEqual(saved.update.skipped, []);
});

test("markDone es idempotente y nunca lanza hacia fuera", async () => {
  const f = fresh();
  f.state = { skipped: [], done: ["try_agent"], dismissedAt: null, completedAt: null };
  const { svc, upserts } = service(f);
  await svc.markDone("try_agent");
  assert.equal(upserts.length, 0, "ya estaba: no escribe");
  const broken = service(fresh());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (broken.svc as any).prisma.onboardingState.findUnique = async () => {
    throw new Error("BD caída");
  };
  await assert.doesNotReject(() => broken.svc.markDone("try_agent"));
});

test("los tours vistos se guardan por usuario, sin repetir", async () => {
  const f = fresh();
  f.toursSeen = ["inbox"];
  const { svc } = service(f);
  await svc.tourSeen("u1", "inbox");
  await svc.tourSeen("u1", "pipeline");
  assert.deepEqual(f.toursSeen, ["inbox", "pipeline"]);
  assert.deepEqual((await svc.status("u1")).toursSeen, ["inbox", "pipeline"]);
});
