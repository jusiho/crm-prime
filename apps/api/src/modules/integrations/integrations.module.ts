import { Global, Module } from "@nestjs/common";
import { IntegrationSettingsService } from "./integration-settings.service";
import { IntegrationsController } from "./integrations.controller";

// Global: las credenciales las consultan el guard del webhook, el proveedor
// de embeddings y el servicio de conexiones de WhatsApp.
@Global()
@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationSettingsService],
  exports: [IntegrationSettingsService],
})
export class IntegrationsModule {}
