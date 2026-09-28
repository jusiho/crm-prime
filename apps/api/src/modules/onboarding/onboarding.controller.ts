import { Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  onboardingStepKeySchema,
  Role,
  tourKeySchema,
  type AccessTokenClaims,
  type OnboardingDto,
  type OnboardingStepKey,
  type TourKey,
} from "@crm/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { OnboardingService } from "./onboarding.service";

@Controller("onboarding")
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  status(@CurrentUser() user: AccessTokenClaims): Promise<OnboardingDto> {
    return this.onboarding.status(user.sub);
  }

  // Omitir / retomar un paso: decisión de empresa, así que solo admin.
  @Post("steps/:key/skip")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async skip(
    @Param("key", new ZodValidationPipe(onboardingStepKeySchema)) key: OnboardingStepKey,
  ): Promise<{ ok: true }> {
    await this.onboarding.skip(key, true);
    return { ok: true };
  }

  @Delete("steps/:key/skip")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async unskip(
    @Param("key", new ZodValidationPipe(onboardingStepKeySchema)) key: OnboardingStepKey,
  ): Promise<{ ok: true }> {
    await this.onboarding.skip(key, false);
    return { ok: true };
  }

  @Post("dismiss")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async dismiss(): Promise<{ ok: true }> {
    await this.onboarding.dismiss(true);
    return { ok: true };
  }

  @Delete("dismiss")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async undismiss(): Promise<{ ok: true }> {
    await this.onboarding.dismiss(false);
    return { ok: true };
  }

  // Los tours son por persona: cualquier usuario marca los suyos.
  @Post("tours/:key")
  async tourSeen(
    @CurrentUser() user: AccessTokenClaims,
    @Param("key", new ZodValidationPipe(tourKeySchema)) key: TourKey,
  ): Promise<{ ok: true }> {
    await this.onboarding.tourSeen(user.sub, key);
    return { ok: true };
  }
}
