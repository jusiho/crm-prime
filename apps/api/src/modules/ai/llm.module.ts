import { Global, Module } from "@nestjs/common";
import { AiSettingsService } from "./ai-settings.service";
import { LLM_PROVIDER } from "./llm.provider";
import { FakeLLMProvider } from "./providers/fake-llm.provider";
import { AnthropicLLMProvider } from "./providers/anthropic-llm.provider";
import { OpenAILLMProvider } from "./providers/openai-llm.provider";
import { RoutingLLMProvider } from "./providers/routing-llm.provider";

/**
 * Expone LLM_PROVIDER. El adaptador concreto (OpenAI / Anthropic / simulado)
 * se elige en cada llamada según Ajustes › Inteligencia Artificial, con
 * respaldo en OPENAI_API_KEY / ANTHROPIC_API_KEY del entorno.
 */
@Global()
@Module({
  providers: [
    AiSettingsService,
    FakeLLMProvider,
    AnthropicLLMProvider,
    OpenAILLMProvider,
    RoutingLLMProvider,
    { provide: LLM_PROVIDER, useExisting: RoutingLLMProvider },
  ],
  exports: [
    LLM_PROVIDER,
    AiSettingsService,
    FakeLLMProvider,
    AnthropicLLMProvider,
    OpenAILLMProvider,
  ],
})
export class LlmModule {}
