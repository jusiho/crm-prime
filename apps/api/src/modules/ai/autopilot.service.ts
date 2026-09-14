import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AiMode,
  ConversationStatus,
  MessageAuthor,
  MessageType,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { MessagingService } from "../messaging/messaging.service";
import { AgentService } from "./agent.service";
import {
  WHATSAPP_PROVIDER,
  type WhatsAppProvider,
} from "../whatsapp/whatsapp-provider.interface";

/**
 * Responde automáticamente a mensajes entrantes cuando la conversación está
 * en modo AUTOPILOT. Aplica los guardrails antes de enviar:
 *  - solo autopilot, contacto con opt-in, IA no pausada por un humano,
 *  - dentro de la ventana de 24h,
 *  - la IA no recomienda escalar.
 * Si algún guardrail falla, marca la conversación como PENDING para un humano.
 */
@Injectable()
export class AutopilotService {
  private readonly logger = new Logger("Autopilot");

  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: AgentService,
    private readonly messaging: MessagingService,
    @Inject(WHATSAPP_PROVIDER) private readonly wa: WhatsAppProvider,
  ) {}

  /**
   * Muestra "escribiendo…" al cliente. Necesita el waMessageId del último
   * entrante, que es sobre el que Meta cuelga el indicador. El indicador
   * caduca solo a los 25 s, así que no hay nada que limpiar.
   */
  private async showTyping(conversationId: string): Promise<void> {
    try {
      const last = await this.prisma.message.findFirst({
        where: { conversationId, direction: "INBOUND", waMessageId: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { waMessageId: true, conversation: { select: { channel: true } } },
      });
      if (!last?.waMessageId) return;
      await this.wa.sendTypingIndicator(
        last.waMessageId,
        last.conversation.channel?.phoneNumberId,
      );
    } catch (e) {
      this.logger.debug(`No se pudo mostrar "escribiendo…": ${(e as Error).message}`);
    }
  }

  /**
   * Ejecuta el agente en autopilot para una conversación. Lo invoca
   * AutomationService tras pasar sus reglas (palabras clave, horario).
   */
  async run(conversationId: string): Promise<void> {
    try {
      const convo = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { contact: true },
      });
      if (!convo || convo.aiMode !== AiMode.AUTOPILOT) return;
      if (!convo.contact.optIn) return;
      if (convo.aiPausedUntil && convo.aiPausedUntil > new Date()) {
        this.logger.debug(`IA pausada (humano activo) en ${conversationId}`);
        return;
      }

      // "Escribiendo…" en el móvil del cliente mientras el modelo redacta.
      // Se lanza sin await: es cosmético y no debe retrasar la respuesta.
      void this.showTyping(conversationId);

      const res = await this.agent.suggest(conversationId);

      if (res.escalate || !res.suggestion || !res.windowOpen) {
        if (convo.status !== ConversationStatus.PENDING) {
          await this.messaging.setStatus(
            conversationId,
            ConversationStatus.PENDING,
          );
        }
        this.logger.log(
          `Autopilot escaló ${conversationId}: ${res.escalationReason ?? "sin respuesta"}`,
        );
        return;
      }

      await this.messaging.queueOutbound(
        { conversationId, type: MessageType.TEXT, text: res.suggestion },
        MessageAuthor.AI,
      );
      this.logger.log(`Autopilot respondió ${conversationId}`);
    } catch (e) {
      this.logger.error(
        `Autopilot falló en ${conversationId}: ${(e as Error).message}`,
      );
    }
  }
}
