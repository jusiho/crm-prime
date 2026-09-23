import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Protege endpoints validando el access token (JwtStrategy).
 *
 * Cualquier fallo (token ausente, vencido o de una sesión revocada) responde
 * con `code: "SESSION_EXPIRED"`: la web lo usa para cerrar la sesión y mandar
 * al login, sin confundirlo con otros 401 (p. ej. contraseña actual errónea).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: "Tu sesión expiró. Vuelve a iniciar sesión.",
        code: "SESSION_EXPIRED",
      });
    }
    return user;
  }
}
