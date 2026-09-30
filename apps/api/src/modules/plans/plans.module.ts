import { Global, Module } from "@nestjs/common";
import { PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";

// Global: los límites se comprueban en WhatsApp, equipo, difusiones y claves
// de API; importarlo en cada módulo no aporta nada.
@Global()
@Module({
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
