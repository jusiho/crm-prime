import { Module } from "@nestjs/common";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService],
  // Otros módulos marcan pasos que no se deducen de los datos (el simulador).
  exports: [OnboardingService],
})
export class OnboardingModule {}
