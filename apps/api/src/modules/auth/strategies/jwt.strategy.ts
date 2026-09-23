import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AccessTokenClaims } from "@crm/shared";
import { PrismaService } from "../../../infra/prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? "dev-secret",
    });
  }

  // El access token es revocable: verificamos que la sesión siga viva.
  async validate(payload: AccessTokenClaims): Promise<AccessTokenClaims> {
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Sesión no válida");
    }
    return {
      sub: payload.sub,
      sid: payload.sid,
      role: payload.role,
      org: payload.org,
    };
  }
}
