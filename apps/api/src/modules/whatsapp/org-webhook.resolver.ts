import { Injectable, NotFoundException } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { runUnscoped } from "../../infra/tenant/tenant.context";
import { hostDe, subdominioDe } from "../../common/utils/subdomain";

/**
 * Qué empresa es la de una ruta de webhook propio. Dos formas de decirlo:
 *
 *   api.driony.com/api/v1/webhooks/whatsapp/acme   ← por la ruta (la normal)
 *   acme.driony.com/api/v1/webhooks/whatsapp       ← por el subdominio
 *
 * La primera llega directa a la API, que es lo que el proxy ya publica en
 * `api.<dominio>`. La segunda solo funciona si el proxy manda `/api/v1` del
 * comodín `*.<dominio>` a la API; si no, se la queda el frontend y responde
 * 404. Por eso la URL que se enseña a las empresas es la primera.
 *
 * El slug solo **elige a quién mirar**, igual que en el login: lo que
 * autentica después es la firma con el app secret que esa empresa guardó. La
 * consulta va sin organización porque es justo lo que se está averiguando.
 */
@Injectable()
export class OrgWebhookResolver {
  constructor(private readonly prisma: PrismaService) {}

  async de(req: Request): Promise<{ id: string; slug: string }> {
    const porRuta = (req.params as { slug?: string } | undefined)?.slug;
    const slug = porRuta?.trim().toLowerCase() || subdominioDe(hostDe(req.headers));
    if (!slug) {
      throw new NotFoundException(
        "Esta ruta necesita el identificador de la empresa: /webhooks/whatsapp/<empresa>",
      );
    }
    const org = await runUnscoped("webhook propio: empresa por slug", () =>
      this.prisma.organization.findUnique({
        where: { slug },
        select: { id: true, slug: true },
      }),
    );
    if (!org) throw new NotFoundException("Empresa no encontrada");
    return org;
  }
}
