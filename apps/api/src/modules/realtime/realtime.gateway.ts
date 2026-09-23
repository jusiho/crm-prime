import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OnEvent } from "@nestjs/event-emitter";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { AccessTokenClaims } from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { corsOrigin } from "../../common/utils/cors-origin";

export interface InboxChangedPayload {
  conversationId: string;
}

@WebSocketGateway({
  // Mismo criterio que la API REST: cualquier subdominio de empresa vale.
  cors: { origin: corsOrigin(), credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger("Realtime");

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // Autenticación en el handshake con el token de realtime (corta vida).
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("sin token");
      const claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      const session = await this.prisma.session.findUnique({
        where: { id: claims.sid },
      });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw new Error("sesión inválida");
      }
      client.data.userId = claims.sub;
      client.join("agents");
    } catch (e) {
      this.logger.warn(`Conexión rechazada: ${(e as Error).message}`);
      client.disconnect(true);
    }
  }

  // Reemite a todos los agentes conectados cuando cambia la bandeja.
  @OnEvent("inbox.changed")
  onInboxChanged(payload: InboxChangedPayload): void {
    this.server.to("agents").emit("inbox.changed", payload);
  }

  // Reemite cuando cambia el pipeline (deal creado/movido/editado).
  @OnEvent("pipeline.changed")
  onPipelineChanged(payload: { dealId: string }): void {
    this.server.to("agents").emit("pipeline.changed", payload);
  }
}
