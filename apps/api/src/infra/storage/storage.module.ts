import { Global, Module } from "@nestjs/common";
import { STORAGE_PROVIDER } from "./storage.provider";
import { LocalStorageProvider } from "./providers/local-storage.provider";

/**
 * Expone STORAGE_PROVIDER. Único adaptador por ahora (disco local); si en el
 * futuro hace falta S3 u otro backend, se elige aquí igual que en LlmModule.
 */
@Global()
@Module({
  providers: [
    LocalStorageProvider,
    { provide: STORAGE_PROVIDER, useExisting: LocalStorageProvider },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
