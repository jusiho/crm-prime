import { Injectable, Logger } from "@nestjs/common";
import { IntegrationSettingsService } from "../../integrations/integration-settings.service";
import {
  EMBEDDING_DIM,
  type EmbeddingProvider,
} from "./embedding.provider";

/**
 * Embedder real con Voyage AI (recomendado por Anthropic; Claude no expone
 * endpoint de embeddings). voyage-3.5 produce vectores de 1024 dimensiones.
 *
 * La key y el modelo se resuelven en cada llamada desde Ajustes ›
 * Integraciones (con respaldo en VOYAGE_API_KEY / VOYAGE_MODEL), para que
 * cambiarlos en la UI surta efecto sin reiniciar la API.
 */
@Injectable()
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly name = "voyage";
  readonly dim = EMBEDDING_DIM;
  private readonly logger = new Logger("VoyageEmbedding");

  constructor(private readonly settings: IntegrationSettingsService) {}

  async embed(texts: string[]): Promise<number[][]> {
    const { apiKey, model } = await this.settings.voyage();
    if (!apiKey) {
      throw new Error(
        "Falta la API key de Voyage. Configúrala en Ajustes › Integraciones.",
      );
    }

    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: texts, model }),
    });
    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Voyage ${res.status}: ${err}`);
      throw new Error(`Voyage embeddings failed ${res.status}`);
    }
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  }
}
