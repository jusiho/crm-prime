import { Controller, Get, UseGuards } from "@nestjs/common";
import type { MyPlanDto } from "@crm/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PlansService } from "./plans.service";

@Controller("plans")
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  /** El plan de mi empresa, su uso y el catálogo. Lo ve cualquier usuario. */
  @Get("me")
  mine(): Promise<MyPlanDto> {
    return this.plans.mine();
  }
}
