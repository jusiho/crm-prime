import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { aiUsagePeriods, Role, type AiUsagePeriod, type AiUsageReport } from "@crm/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AiUsageService } from "./ai-usage.service";

/** Consumo de IA de la empresa (Ajustes › Consumo de IA). Solo administradores. */
@Controller("ai/usage")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AiUsageController {
  constructor(private readonly usage: AiUsageService) {}

  @Get()
  report(@Query("period") period?: string): Promise<AiUsageReport> {
    const p = (aiUsagePeriods as readonly string[]).includes(period ?? "") ? (period as AiUsagePeriod) : "month";
    return this.usage.report(p);
  }
}
