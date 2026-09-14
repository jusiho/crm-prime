import { Injectable, Logger } from "@nestjs/common";
import { IntegrationSettingsService } from "../../integrations/integration-settings.service";
import { EMBEDDING_DIM, type EmbeddingProvider } from "./embedding.provider";
import { FakeEmbeddingProvider } from "./fake-embedding.provider";
import { VoyageEmbeddingProvider } from "./voyage-embedding.provider";

/**
 * Elige el embedder en cada llamada en vez de al arrancar: así, configurar
 * la key de Voyage en Ajustes surte efecto sin reiniciar la API.
 *
 * Aviso importante: los vectores de Voyage y los simulados NO son
 * comparables entre sí. Si se cambia de uno a otro hay que reindexar la base
 * de conocimiento, o las búsquedas devolverán resultados sin sentido.
 */
@Injectable()
export class RoutingEmbeddingProvider implements EmbeddingProvider {
  readonly dim = EMBEDDING_DIM;
  private readonly logger = new Logger("Embeddings");
  private lastUsed = "fake";

  constructor(
    private readonly settings: IntegrationSettingsService,
    private readonly voyage: VoyageEmbeddingProvider,
    private readonly fake: FakeEmbeddingProvider,
  ) {}

  get name(): string {
    return this.lastUsed;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const { apiKey } = await this.settings.voyage();
    const provider: EmbeddingProvider = apiKey ? this.voyage : this.fake;

    if (provider.name !== this.lastUsed) {
      this.lastUsed = provider.name;
      const note = apiKey
        ? ""
        : " (simulado — configura la key de Voyage en Ajustes › Integraciones)";
      this.logger.log(`Embedder activo: ${provider.name}${note}`);
    }
    return provider.embed(texts);
  }
}
