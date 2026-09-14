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
  createFlowSchema,
  flowAssistantRequestSchema,
  updateFlowSchema,
  Role,
  type CreateFlowInput,
  type FlowAssistantRequest,
  type UpdateFlowInput,
} from "@crm/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { FlowService } from "./flow.service";
import { FlowAssistantService } from "./flow-assistant.service";

@Controller("flows")
@UseGuards(JwtAuthGuard)
export class FlowsController {
  constructor(
    private readonly flows: FlowService,
    private readonly assistant: FlowAssistantService,
  ) {}

  @Get()
  list() {
    return this.flows.list();
  }

  // Asistente IA: propone un grafo de bloques; no guarda nada.
  @Post("assistant")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  assist(
    @Body(new ZodValidationPipe(flowAssistantRequestSchema))
    body: FlowAssistantRequest,
  ) {
    return this.assistant.run(body);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.flows.getById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body(new ZodValidationPipe(createFlowSchema)) body: CreateFlowInput) {
    return this.flows.create(body);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateFlowSchema)) body: UpdateFlowInput,
  ) {
    return this.flows.update(id, body);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.flows.remove(id);
  }
}
