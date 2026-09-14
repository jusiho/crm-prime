import { Module } from "@nestjs/common";
import { LlmModule } from "./llm.module";
import { AgentService } from "./agent.service";
import { AgentActionsService } from "./agent-actions.service";
import { AutopilotService } from "./autopilot.service";
import { AutomationService } from "./automation.service";
import { BotService } from "./bot.service";
import { FlowService } from "./flow.service";
import { FlowAssistantService } from "./flow-assistant.service";
import { FlowEngineService } from "./flow-engine.service";
import { FlowProcessor } from "./flow.processor";
import { AiController } from "./ai.controller";
import { BotsController } from "./bots.controller";
import { FlowsController } from "./flows.controller";
import { AiSettingsController } from "./ai-settings.controller";
import { MessagingModule } from "../messaging/messaging.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";

@Module({
  imports: [LlmModule, MessagingModule, KnowledgeModule],
  controllers: [
    AiController,
    BotsController,
    FlowsController,
    AiSettingsController,
  ],
  providers: [
    AgentService,
    AgentActionsService,
    AutopilotService,
    AutomationService,
    BotService,
    FlowService,
    FlowAssistantService,
    FlowEngineService,
    FlowProcessor,
  ],
})
export class AiModule {}
