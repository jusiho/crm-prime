import { Module } from "@nestjs/common";
import { EmbeddingModule } from "./embeddings/embedding.module";
import { KnowledgeService } from "./knowledge.service";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeGapsService } from "./knowledge-gaps.service";

@Module({
  imports: [EmbeddingModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeGapsService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
