import { Injectable, NotFoundException } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { runUnscoped } from "../../infra/tenant/tenant.context";
import { hostDe, subdominioDe } from "../../common/utils/subdomain";

/**
 * Qué empresa es la de una ruta de webhook bajo subdominio
 * (`acme.trimmo.lat/api/v1/webhooks/whatsapp`).
 *
 * El subdominio solo **elige a quién mirar**, igual que en el login: lo que
 * autentica después es la firma con el app secret que esa empresa guardó. La
 * consulta va sin organización porque es justo lo que se está averiguando.
 */
@Injectable()
export class OrgWebhookResolver {
  constructor(private readonly prisma: PrismaService) {}

  async porHost(req: Request): Promise<{ id: string; slug: string }> {
    const slug = subdominioDe(hostDe(req.headers));
    if (!slug) {
      throw new NotFoundException("Esta ruta solo existe bajo el subdominio de una empresa");
    }
    const org = await runUnscoped("webhook propio: empresa por subdominio", () =>
      this.prisma.organization.findUnique({
        where: { slug },
        select: { id: true, slug: true },
      }),
    );
    if (!org) throw new NotFoundException("Empresa no encontrada");
    return org;
  }
}
