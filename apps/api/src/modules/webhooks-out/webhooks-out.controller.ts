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
  createWebhookSchema,
  updateWebhookSchema,
  Role,
  type CreateWebhookInput,
  type UpdateWebhookInput,
} from "@crm/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { WebhookOutService } from "./webhook-out.service";

@Controller("webhooks-out")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class WebhooksOutController {
  constructor(private readonly webhooks: WebhookOutService) {}

  @Get()
  list() {
    return this.webhooks.list();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createWebhookSchema)) body: CreateWebhookInput,
  ) {
    return this.webhooks.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateWebhookSchema)) body: UpdateWebhookInput,
  ) {
    return this.webhooks.update(id, body);
  }

  @Post(":id/test")
  test(@Param("id") id: string) {
    return this.webhooks.test(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.webhooks.remove(id);
  }
}
