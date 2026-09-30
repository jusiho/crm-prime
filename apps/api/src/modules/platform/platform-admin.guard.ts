import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { AccessTokenClaims } from "@crm/shared";
import { isPlatformAdmin } from "../../common/utils/platform-admin";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { runInOrg, tenancyMode } from "../../infra/tenant/tenant.context";

/**
 * Solo el operador de la plataforma. Va detrás de JwtAuthGuard.
 *
 * El correo se lee de la base y no del token: si alguien deja de ser operador
 * basta con quitarlo de PLATFORM_ADMIN_EMAILS, sin esperar a que caduque nada.
 * Los guardias corren antes de que el interceptor fije la empresa, así que la
 * consulta se acota aquí a mano con la del propio token.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (tenancyMode !== "multi") {
      throw new ForbiddenException("La consola de plataforma solo existe en modo SaaS");
    }
    const claims = ctx.switchToHttp().getRequest().user as AccessTokenClaims | undefined;
    if (!claims?.sub || !claims.org) throw new UnauthorizedException();

    const user = await runInOrg(claims.org, () =>
      this.prisma.user.findUnique({
        where: { id: claims.sub },
        select: { email: true, isActive: true },
      }),
    );
    if (!user?.isActive || !isPlatformAdmin(user.email)) {
      throw new ForbiddenException("Solo el operador de la plataforma puede entrar aquí");
    }
    return true;
  }
}
