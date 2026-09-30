import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import {
  updatePlatformOrgSchema,
  type PlatformOrg,
  type PlatformOverview,
  type UpdatePlatformOrgInput,
} from "@crm/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { PlatformService } from "./platform.service";

/** Consola del operador del SaaS: todas las empresas, altas, planes. */
@Controller("platform")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("overview")
  overview(): Promise<PlatformOverview> {
    return this.platform.overview();
  }

  @Get("orgs")
  orgs(@Query("search") search?: string): Promise<PlatformOrg[]> {
    return this.platform.orgs(search ?? "");
  }

  @Patch("orgs/:id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePlatformOrgSchema)) body: UpdatePlatformOrgInput,
  ): Promise<PlatformOrg> {
    return this.platform.update(id, body);
  }
}
