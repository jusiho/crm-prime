import { Global, Module } from "@nestjs/common";
import { EMBEDDING_PROVIDER } from "./embedding.provider";
import { FakeEmbeddingProvider } from "./fake-embedding.provider";
import { VoyageEmbeddingProvider } from "./voyage-embedding.provider";
import { RoutingEmbeddingProvider } from "./routing-embedding.provider";

@Global()
@Module({
  providers: [
    FakeEmbeddingProvider,
    VoyageEmbeddingProvider,
    RoutingEmbeddingProvider,
    { provide: EMBEDDING_PROVIDER, useExisting: RoutingEmbeddingProvider },
  ],
  exports: [EMBEDDING_PROVIDER],
})
export class EmbeddingModule {}
