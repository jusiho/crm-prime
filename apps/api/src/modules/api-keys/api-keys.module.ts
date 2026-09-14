import { Global, Module } from "@nestjs/common";
import { ApiKeyService } from "./api-key.service";
import { ApiKeysController } from "./api-keys.controller";

// Global: el ApiKeyGuard se usa desde otros módulos (webhooks de leads…).
@Global()
@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class ApiKeysModule {}
