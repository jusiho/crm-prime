import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  createDealSchema,
  createPipelineSchema,
  createStageSchema,
  discardDealSchema,
  moveDealSchema,
  reorderPipelinesSchema,
  reorderStagesSchema,
  updateDealSchema,
  updatePipelineSchema,
  updateStageSchema,
  type CreateDealInput,
  type CreatePipelineInput,
  type CreateStageInput,
  type DiscardDealInput,
  type MoveDealInput,
  type ReorderPipelinesInput,
  type ReorderStagesInput,
  type UpdateDealInput,
  type UpdatePipelineInput,
  type UpdateStageInput,
} from "@crm/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PipelineService } from "./pipeline.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  // Tablero de un embudo (por defecto, el predeterminado). `view=discarded`
  // devuelve las oportunidades descartadas en vez de las abiertas.
  @Get("pipeline")
  getPipeline(@Query("id") id?: string, @Query("view") view?: string) {
    return this.pipeline.getPipeline(id || undefined, view === "discarded" ? "discarded" : "open");
  }

  // ── Embudos ────────────────────────────────────────────────
  @Get("pipelines")
  listPipelines() {
    return this.pipeline.listPipelines();
  }

  @Post("pipelines")
  createPipeline(
    @Body(new ZodValidationPipe(createPipelineSchema)) body: CreatePipelineInput,
  ) {
    return this.pipeline.createPipeline(body);
  }

  @Patch("pipelines/reorder")
  reorderPipelines(
    @Body(new ZodValidationPipe(reorderPipelinesSchema)) body: ReorderPipelinesInput,
  ) {
    return this.pipeline.reorderPipelines(body.ids);
  }

  @Patch("pipelines/:id")
  updatePipeline(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePipelineSchema)) body: UpdatePipelineInput,
  ) {
    return this.pipeline.updatePipeline(id, body);
  }

  @Delete("pipelines/:id")
  deletePipeline(@Param("id") id: string) {
    return this.pipeline.deletePipeline(id);
  }

  // ── Oportunidades ──────────────────────────────────────────
  @Post("deals")
  createDeal(
    @Body(new ZodValidationPipe(createDealSchema)) body: CreateDealInput,
  ) {
    return this.pipeline.createDeal(body);
  }

  @Patch("deals/:id/stage")
  moveDeal(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(moveDealSchema)) body: MoveDealInput,
  ) {
    return this.pipeline.moveDeal(id, body);
  }

  @Post("deals/:id/discard")
  discardDeal(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(discardDealSchema)) body: DiscardDealInput,
  ) {
    return this.pipeline.discardDeal(id, body);
  }

  @Post("deals/:id/restore")
  restoreDeal(@Param("id") id: string) {
    return this.pipeline.restoreDeal(id);
  }

  @Patch("deals/:id")
  updateDeal(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDealSchema)) body: UpdateDealInput,
  ) {
    return this.pipeline.updateDeal(id, body);
  }

  @Delete("deals/:id")
  deleteDeal(@Param("id") id: string) {
    return this.pipeline.deleteDeal(id);
  }

  // ── Etapas ─────────────────────────────────────────────────
  @Post("stages")
  createStage(
    @Body(new ZodValidationPipe(createStageSchema)) body: CreateStageInput,
  ) {
    return this.pipeline.createStage(body);
  }

  @Patch("stages/reorder")
  reorderStages(
    @Body(new ZodValidationPipe(reorderStagesSchema)) body: ReorderStagesInput,
  ) {
    return this.pipeline.reorderStages(body);
  }

  @Patch("stages/:id")
  updateStage(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateStageSchema)) body: UpdateStageInput,
  ) {
    return this.pipeline.updateStage(id, body);
  }

  @Delete("stages/:id")
  deleteStage(@Param("id") id: string) {
    return this.pipeline.deleteStage(id);
  }
}
