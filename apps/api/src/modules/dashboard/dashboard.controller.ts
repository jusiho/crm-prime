import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { dashboardPeriods, type DashboardDto, type DashboardPeriod } from "@crm/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(
    @Query("period") period?: string,
    @Query("tz") tz?: string,
    @Query("pipelineId") pipelineId?: string,
  ): Promise<DashboardDto> {
    const p = (dashboardPeriods as readonly string[]).includes(period ?? "") ? (period as DashboardPeriod) : "30d";
    return this.dashboard.get(p, tz, pipelineId || undefined);
  }
}
