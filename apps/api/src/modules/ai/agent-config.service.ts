import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  AgentConfigDto,
  EscalationRules,
  UpdateAgentConfigInput,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AgentActionsService } from "./agent-actions.service";
import { availableTools, type ToolContext } from "./tools.registry";

@Injectable()
export class AgentConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actions: AgentActionsService,
  ) {}

  async getConfig(): Promise<AgentConfigDto> {
    const config = await this.ensureDefault();
    return this.toDto(config, await this.actions.loadContext());
  }

  async updateConfig(input: UpdateAgentConfigInput): Promise<AgentConfigDto> {
    const config = await this.ensureDefault();
    const updated = await this.prisma.agentConfig.update({
      where: { id: config.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.effort !== undefined ? { effort: input.effort } : {}),
        ...(input.systemPrompt !== undefined
          ? { systemPrompt: input.systemPrompt }
          : {}),
        ...(input.enabledTools !== undefined
          ? { enabledTools: input.enabledTools }
          : {}),
        ...(input.maxIterations !== undefined
          ? { maxIterations: input.maxIterations }
          : {}),
        ...(input.escalationRules !== undefined
          ? {
              escalationRules:
                input.escalationRules as unknown as Prisma.InputJsonObject,
            }
          : {}),
        ...(input.monthlyTokenBudget !== undefined
          ? { monthlyTokenBudget: input.monthlyTokenBudget }
          : {}),
      },
    });
    return this.toDto(updated, await this.actions.loadContext());
  }

  private async ensureDefault() {
    const existing = await this.prisma.agentConfig.findFirst({
      where: { isDefault: true },
    });
    if (existing) return existing;
    return this.prisma.agentConfig.create({
      data: {
        name: "Agente por defecto",
        model: "claude-opus-4-8",
        effort: "medium",
        maxIterations: 6,
        isDefault: true,
        enabledTools: ["search_contact", "handoff_to_human"],
        systemPrompt:
          "Eres un asistente de atención al cliente por WhatsApp. Responde en español, breve y cordial.",
      },
    });
  }

  private toDto(
    c: {
      id: string;
      name: string;
      model: string;
      effort: string;
      systemPrompt: string;
      enabledTools: string[];
      maxIterations: number;
      escalationRules: unknown;
      monthlyTokenBudget: number;
    },
    toolContext: ToolContext,
  ): AgentConfigDto {
    return {
      id: c.id,
      name: c.name,
      model: c.model,
      effort: c.effort,
      systemPrompt: c.systemPrompt,
      enabledTools: c.enabledTools,
      maxIterations: c.maxIterations,
      escalationRules: (c.escalationRules as EscalationRules | null) ?? {},
      monthlyTokenBudget: c.monthlyTokenBudget,
      availableTools: availableTools(toolContext),
    };
  }
}
