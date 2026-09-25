// Resuelve la key de OpenAI de una empresa con el TENANCY_MODE y el
// AI_SHARED_KEYS que le pase el test, en un proceso aparte (el modo se lee
// al importar). Imprime de dónde salió la key, nunca la key.
//
//   argv[2] = "db"  → la empresa tiene una key propia guardada
//   argv[2] = "none" → no tiene ninguna
import { AiSettingsService } from "../../src/modules/ai/ai-settings.service";
import { encryptSecret } from "../../src/common/utils/secret-box";

const propia = process.argv[2] === "db";

const row = {
  provider: "auto",
  openaiKeyEnc: propia ? encryptSecret("sk-propia-de-la-empresa") : null,
  anthropicKeyEnc: null,
  openaiModel: "gpt-4o-mini",
  anthropicModel: "claude-opus-4-8",
  openaiBaseUrl: null,
};

const prisma = { aiSetting: { upsert: async () => row, update: async () => row } };
const tenant = { orgId: () => "org_a" };

const svc = new AiSettingsService(prisma as never, tenant as never);
svc.getSettings().then(
  (dto) =>
    console.log(
      JSON.stringify({
        ok: true,
        source: dto.openaiKey.source,
        active: dto.activeProvider,
        platformKeys: dto.platformKeys,
        saas: dto.saas,
      }),
    ),
  (e: Error) => console.log(JSON.stringify({ ok: false, msg: e.message })),
);
