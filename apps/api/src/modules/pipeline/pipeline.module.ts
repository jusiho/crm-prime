import { Global, Module } from "@nestjs/common";
import { PipelineController } from "./pipeline.controller";
import { PipelineService } from "./pipeline.service";

// Global: la entrada automática al embudo la llama el servicio de mensajería
// con cada mensaje entrante.
@Global()
@Module({
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
