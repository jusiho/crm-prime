import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Organización ───────────────────────────────────────────
  // Todo cuelga de aquí. En la versión open source hay una sola y el CRM se
  // usa igual que siempre; en modo SaaS habría una por empresa.
  const org = await prisma.organization.upsert({
    where: { slug: "default" },
    update: {},
    create: { slug: "default", name: "Mi empresa" },
  });
  console.log(`✔ Organización: ${org.name} (${org.slug})`);

  // ── Usuario admin ──────────────────────────────────────────
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@crm.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      orgId: org.id,
      email,
      passwordHash,
      name: "Admin",
      role: "ADMIN",
    },
  });
  console.log(`✔ Admin: ${admin.email} (password: ${password})`);

  // ── Etapas del pipeline (kanban) ───────────────────────────
  const stages = [
    { name: "Nuevo", order: 0 },
    { name: "Contactado", order: 1 },
    { name: "Calificado", order: 2 },
    { name: "Propuesta", order: 3 },
    { name: "Ganado", order: 4, isWon: true },
    { name: "Perdido", order: 5, isLost: true },
  ];
  for (const s of stages) {
    await prisma.pipelineStage.upsert({
      where: { orgId_order: { orgId: org.id, order: s.order } },
      update: { name: s.name },
      create: { ...s, orgId: org.id },
    });
  }
  console.log(`✔ ${stages.length} etapas de pipeline`);

  // ── Configuración de agente IA por defecto ─────────────────
  const existing = await prisma.agentConfig.findFirst({
    where: { orgId: org.id, isDefault: true },
  });
  if (!existing) {
    await prisma.agentConfig.create({
      data: {
        orgId: org.id,
        name: "Agente por defecto",
        model: "claude-opus-4-8",
        effort: "medium",
        maxIterations: 6,
        isDefault: true,
        enabledTools: [
          "search_contact",
          "update_contact",
          "search_knowledge",
          "schedule_followup",
          "handoff_to_human",
        ],
        systemPrompt: [
          "Eres un asistente de atención al cliente por WhatsApp.",
          "Responde en español, con tono cercano y profesional.",
          "Usa las herramientas disponibles para consultar y actuar en el CRM.",
          "Si no estás seguro, el cliente se enoja, o el tema excede tu alcance,",
          "escala a un humano con la herramienta handoff_to_human.",
          "Nunca inventes información que no puedas verificar con las herramientas.",
        ].join(" "),
        escalationRules: {
          minConfidence: 0.6,
          escalateOnNegativeSentiment: true,
          keywords: ["humano", "agente", "persona", "reclamo"],
        },
      },
    });
    console.log("✔ AgentConfig por defecto");
  }

  console.log("\n🌱 Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
