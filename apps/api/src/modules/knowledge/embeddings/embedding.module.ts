import { Global, Module } from "@nestjs/common";
import { EMBEDDING_PROVIDER } from "./embedding.provider";
import { FakeEmbeddingProvider } from "./fake-embedding.provider";
import { VoyageEmbeddingProvider } from "./voyage-embedding.provider";
import { OpenAIEmbeddingProvider } from "./openai-embedding.provider";
import { RoutingEmbeddingProvider } from "./routing-embedding.provider";

@Global()
@Module({
  providers: [
    FakeEmbeddingProvider,
    VoyageEmbeddingProvider,
    OpenAIEmbeddingProvider,
    RoutingEmbeddingProvider,
    { provide: EMBEDDING_PROVIDER, useExisting: RoutingEmbeddingProvider },
  ],
  exports: [EMBEDDING_PROVIDER],
})
export class EmbeddingModule {}
