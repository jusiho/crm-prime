import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import {
  resolveActionsSchema,
  type AccessTokenClaims,
  type ResolveActionsInput,
} from "@crm/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AgentActionsService } from "./agent-actions.service";
import { AgentService } from "./agent.service";

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly agent: AgentService,
    private readonly actions: AgentActionsService,
  ) {}

  // Copilot: la IA redacta una sugerencia de respuesta (el humano la revisa).
  @Post(":id/ai/suggest")
  suggest(@Param("id") id: string) {
    return this.agent.suggest(id);
  }

  // Resuelve las acciones que la IA dejó pendientes en ese run: se aplican
  // cuando el humano envía la respuesta, o se descartan si la desecha.
  @Post(":id/ai/runs/:runId/actions")
  resolveActions(
    @Param("runId") runId: string,
    @Body(new ZodValidationPipe(resolveActionsSchema))
    body: ResolveActionsInput,
    @CurrentUser() user: AccessTokenClaims,
  ) {
    return this.actions.resolve(runId, body.approve, user.sub);
  }
}
