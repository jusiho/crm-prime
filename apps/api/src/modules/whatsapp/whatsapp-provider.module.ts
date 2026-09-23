import { Global, Logger, Module, type OnModuleInit } from "@nestjs/common";
import { WHATSAPP_PROVIDER } from "./whatsapp-provider.interface";
import { MetaWhatsAppProvider } from "./providers/meta-whatsapp.provider";
import { WhatsappConnectionService } from "./whatsapp-connection.service";
import { runUnscoped } from "../../infra/tenant/tenant.context";

/**
 * Expone WHATSAPP_PROVIDER (siempre el adaptador de Meta) y el servicio de
 * conexión. El adaptador resuelve credenciales en runtime (Embedded Signup en
 * BD o .env); si no hay, opera en modo simulado. Así, conectar desde la UI
 * surte efecto sin reiniciar.
 */
@Global()
@Module({
  providers: [
    WhatsappConnectionService,
    MetaWhatsAppProvider,
    { provide: WHATSAPP_PROVIDER, useExisting: MetaWhatsAppProvider },
  ],
  exports: [WHATSAPP_PROVIDER, WhatsappConnectionService],
})
export class WhatsappProviderModule implements OnModuleInit {
  constructor(private readonly connection: WhatsappConnectionService) {}

  async onModuleInit(): Promise<void> {
    // Recuento de arranque, a propósito por encima de todas las empresas: es
    // un log de infraestructura, no datos de nadie.
    const channels = await runUnscoped("arranque: contar números conectados", () =>
      this.connection.listChannels(),
    ).catch(() => []);
    const log = new Logger("WhatsApp");
    if (channels.length === 0) {
      log.log("Sin números de WhatsApp (modo simulado — conéctalos desde el panel)");
      return;
    }
    const names = channels
      .map((c) => c.displayPhoneNumber ?? c.phoneNumberId)
      .join(", ");
    log.log(`${channels.length} número(s) de WhatsApp conectados: ${names}`);
  }
}
