import { Injectable, Logger } from "@nestjs/common";
import { IntegrationSettingsService } from "../../integrations/integration-settings.service";
import { EMBEDDING_DIM, type EmbeddingProvider } from "./embedding.provider";
import { FakeEmbeddingProvider } from "./fake-embedding.provider";
import { OpenAIEmbeddingProvider } from "./openai-embedding.provider";
import { VoyageEmbeddingProvider } from "./voyage-embedding.provider";

/**
 * Elige el embedder en cada llamada en vez de al arrancar: así, configurar
 * una clave en Ajustes surte efecto sin reiniciar la API.
 *
 * Orden: Voyage si la empresa lo configuró; si no, la clave de OpenAI de la
 * empresa; si no, el simulado (solo sirve para probar).
 *
 * Aviso importante: los vectores de cada proveedor NO son comparables entre
 * sí. Si se cambia de uno a otro hay que reindexar la base de conocimiento
 * (Conocimiento › Reindexar), o las búsquedas devolverán resultados sin
 * sentido. Cada documento guarda con qué se indexó para poder avisarlo.
 */
@Injectable()
export class RoutingEmbeddingProvider implements EmbeddingProvider {
  readonly dim = EMBEDDING_DIM;
  private readonly logger = new Logger("Embeddings");
  private lastUsed = "fake";

  constructor(
    private readonly settings: IntegrationSettingsService,
    private readonly voyage: VoyageEmbeddingProvider,
    private readonly openai: OpenAIEmbeddingProvider,
    private readonly fake: FakeEmbeddingProvider,
  ) {}

  get name(): string {
    return this.lastUsed;
  }

  /** Con qué se embebería ahora, sin llamar a nadie. */
  async current(): Promise<string> {
    return (await this.pick()).name;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const provider = await this.pick();
    if (provider.name !== this.lastUsed) {
      this.lastUsed = provider.name;
      const note =
        provider.name === "fake"
          ? " (simulado — configura tu clave de OpenAI en Ajustes › Inteligencia Artificial)"
          : "";
      this.logger.log(`Embedder activo: ${provider.name}${note}`);
    }
    return provider.embed(texts);
  }

  private async pick(): Promise<EmbeddingProvider> {
    const { apiKey } = await this.settings.voyage();
    if (apiKey) return this.voyage;
    if (await this.openai.available()) return this.openai;
    return this.fake;
  }
}
