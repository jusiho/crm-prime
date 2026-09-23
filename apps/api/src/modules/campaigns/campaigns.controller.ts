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
  createCampaignSchema,
  createTemplateSchema,
  updateCampaignSchema,
  updateTemplateSchema,
  Role,
  type CreateCampaignInput,
  type CreateTemplateInput,
  type UpdateCampaignInput,
  type UpdateTemplateInput,
} from "@crm/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { TemplateService } from "./template.service";
import { CampaignService } from "./campaign.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(
    private readonly templates: TemplateService,
    private readonly campaigns: CampaignService,
  ) {}

  // ── Plantillas ─────────────────────────────────────────────
  @Get("templates")
  listTemplates() {
    return this.templates.list();
  }

  @Post("templates")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  createTemplate(
    @Body(new ZodValidationPipe(createTemplateSchema)) body: CreateTemplateInput,
  ) {
    return this.templates.create(body);
  }

  @Patch("templates/:id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateTemplate(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTemplateSchema)) body: UpdateTemplateInput,
  ) {
    return this.templates.update(id, body);
  }

  @Delete("templates/:id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  removeTemplate(@Param("id") id: string) {
    return this.templates.remove(id);
  }

  // Trae del panel de Meta las plantillas ya creadas (y sus estados).
  @Post("templates/sync")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  syncTemplates() {
    return this.templates.importFromMeta();
  }

  // ── Campañas ───────────────────────────────────────────────
  @Get("campaigns/meta")
  meta() {
    return this.campaigns.meta();
  }

  @Get("campaigns/audience")
  audience(@Query("tagIds") tagIds?: string) {
    const ids = tagIds ? tagIds.split(",").filter(Boolean) : [];
    return this.campaigns.audiencePreview(ids);
  }

  @Get("campaigns")
  list() {
    return this.campaigns.list();
  }

  @Get("campaigns/:id")
  get(@Param("id") id: string) {
    return this.campaigns.getById(id);
  }

  @Post("campaigns")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  create(
    @Body(new ZodValidationPipe(createCampaignSchema)) body: CreateCampaignInput,
  ) {
    return this.campaigns.create(body);
  }

  @Patch("campaigns/:id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCampaignSchema)) body: UpdateCampaignInput,
  ) {
    return this.campaigns.update(id, body);
  }

  @Post("campaigns/:id/launch")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  launch(@Param("id") id: string) {
    return this.campaigns.launch(id);
  }

  @Post("campaigns/:id/cancel")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  cancel(@Param("id") id: string) {
    return this.campaigns.cancel(id);
  }

  @Delete("campaigns/:id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.campaigns.remove(id);
  }
}
