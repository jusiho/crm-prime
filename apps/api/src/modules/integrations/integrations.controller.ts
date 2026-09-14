import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import {
  updateIntegrationSettingsSchema,
  Role,
  type IntegrationSettingsDto,
  type IntegrationTestResult,
  type UpdateIntegrationSettingsInput,
} from "@crm/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { IntegrationSettingsService } from "./integration-settings.service";

@Controller("integrations/settings")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class IntegrationsController {
  constructor(private readonly settings: IntegrationSettingsService) {}

  @Get()
  get(): Promise<IntegrationSettingsDto> {
    return this.settings.getSettings();
  }

  @Patch()
  update(
    @Body(new ZodValidationPipe(updateIntegrationSettingsSchema))
    body: UpdateIntegrationSettingsInput,
  ): Promise<IntegrationSettingsDto> {
    return this.settings.updateSettings(body);
  }

  @Post("test")
  test(): Promise<IntegrationTestResult> {
    return this.settings.test();
  }
}
