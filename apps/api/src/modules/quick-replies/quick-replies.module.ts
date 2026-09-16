import { Module } from "@nestjs/common";
import { QuickReplyService } from "./quick-reply.service";
import { QuickRepliesController } from "./quick-replies.controller";

@Module({
  controllers: [QuickRepliesController],
  providers: [QuickReplyService],
})
export class QuickRepliesModule {}
