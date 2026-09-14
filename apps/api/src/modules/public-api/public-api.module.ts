import { Module } from "@nestjs/common";
import { MessagingModule } from "../messaging/messaging.module";
import { PublicApiController } from "./public-api.controller";
import { PublicApiService } from "./public-api.service";

@Module({
  imports: [MessagingModule],
  controllers: [PublicApiController],
  providers: [PublicApiService],
})
export class PublicApiModule {}
