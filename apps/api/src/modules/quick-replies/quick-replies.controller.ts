import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  createQuickReplySchema,
  updateQuickReplySchema,
  type CreateQuickReplyInput,
  type UpdateQuickReplyInput,
} from "@crm/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { QuickReplyService } from "./quick-reply.service";

// Las respuestas rápidas las usa todo el equipo, así que cualquier agente
// puede leerlas; crearlas y editarlas queda para quien gestione el CRM.
@Controller("quick-replies")
@UseGuards(JwtAuthGuard)
export class QuickRepliesController {
  constructor(private readonly quickReplies: QuickReplyService) {}

  @Get()
  list() {
    return this.quickReplies.list();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createQuickReplySchema))
    body: CreateQuickReplyInput,
  ) {
    return this.quickReplies.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateQuickReplySchema))
    body: UpdateQuickReplyInput,
  ) {
    return this.quickReplies.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.quickReplies.remove(id);
  }
}
