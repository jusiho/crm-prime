import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  acceptKnowledgeSuggestionSchema,
  importUrlSchema,
  ingestKnowledgeSchema,
  Role,
  type AcceptKnowledgeSuggestionInput,
  type ImportUrlInput,
  type IngestKnowledgeInput,
} from "@crm/shared";
import { HttpCode } from "@nestjs/common";
import { KnowledgeGapsService } from "./knowledge-gaps.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { KnowledgeService } from "./knowledge.service";

@Controller("knowledge")
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly gaps: KnowledgeGapsService,
  ) {}

  /** Con qué se indexa ahora y cuántos documentos hay que reindexar. */
  @Get("status")
  status() {
    return this.knowledge.indexStatus();
  }

  @Post("reindex")
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  reindex() {
    return this.knowledge.reindex();
  }

  @Post("import-url")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  importUrl(@Body(new ZodValidationPipe(importUrlSchema)) body: ImportUrlInput) {
    return this.knowledge.importUrl(body);
  }

  // ── Preguntas sin respuesta ─────────────────────────────────
  @Get("suggestions")
  suggestions() {
    return this.gaps.list();
  }

  @Post("suggestions/analyze")
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  analyze() {
    return this.gaps.analyze();
  }

  @Post("suggestions/:id/accept")
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  accept(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(acceptKnowledgeSuggestionSchema)) body: AcceptKnowledgeSuggestionInput,
  ) {
    return this.gaps.accept(id, body);
  }

  @Post("suggestions/:id/dismiss")
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  dismiss(@Param("id") id: string) {
    return this.gaps.dismiss(id);
  }

  @Get()
  list() {
    return this.knowledge.listDocs();
  }

  @Get("search")
  search(@Query("q") q: string) {
    return this.knowledge.search(q ?? "");
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  ingest(
    @Body(new ZodValidationPipe(ingestKnowledgeSchema))
    body: IngestKnowledgeInput,
  ) {
    return this.knowledge.ingest(body);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async remove(@Param("id") id: string) {
    await this.knowledge.deleteDoc(id);
    return { ok: true };
  }
}
