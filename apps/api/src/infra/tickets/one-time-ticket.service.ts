import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";

export interface TicketClaims {
  sub: string;
  jti: string;
  purpose: string;
  exp?: number;
}

/**
 * Pases firmados de un solo uso.
 *
 * Sirven para cruzar un límite que una cookie no cruza: de `trimmo.lat` a
 * `acme.trimmo.lat` tras el alta, o del panel de una empresa al conector de
 * Meta en el dominio raíz. Un pase dice "este usuario de esta empresa quiere
 * hacer esto", va firmado, caduca pronto y **solo vale una vez**.
 *
 * Viaja en la URL, así que acaba en el historial del navegador y quizá en un
 * log; por eso no puede servir dos veces ni durar más que el trámite.
 *
 * Los `jti` canjeados se recuerdan en memoria del proceso, igual que el límite
 * de intentos de login. Con varias instancias detrás del proxy cada una lleva
 * su lista; el día que haya más de una, esto va a Redis.
 */
@Injectable()
export class OneTimeTicketService {
  private readonly usados = new Map<string, number>();

  constructor(private readonly jwt: JwtService) {}

  /** Emite un pase para `purpose` con estos datos, que caduca en `ttl` ("15m"). */
  async issue(
    purpose: string,
    claims: { sub: string } & Record<string, unknown>,
    ttl: string,
  ): Promise<string> {
    return this.jwt.signAsync(
      { ...claims, purpose, jti: randomUUID() },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ttl },
    );
  }

  /**
   * Canjea un pase. Lanza si caducó, si es de otro propósito, si está
   * manipulado o si ya se usó. Los mensajes son los mismos que ve el usuario.
   */
  async redeem<T extends object = Record<string, unknown>>(
    purpose: string,
    token: string,
  ): Promise<TicketClaims & T> {
    let claims: TicketClaims & T;
    try {
      claims = await this.jwt.verifyAsync<TicketClaims & T>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException("El pase ha caducado o no es válido");
    }
    if (claims.purpose !== purpose || !claims.sub || !claims.jti) {
      throw new UnauthorizedException("El pase no es válido");
    }

    this.prune();
    if (this.usados.has(claims.jti)) {
      throw new UnauthorizedException("Este pase ya se usó");
    }
    // Se recuerda hasta un minuto después de su caducidad, por si algún reloj
    // va desajustado; pasado eso el propio JWT ya no vale.
    const hasta = (claims.exp ?? Math.floor(Date.now() / 1000)) * 1000 + 60_000;
    this.usados.set(claims.jti, hasta);
    return claims;
  }

  private prune(): void {
    const ahora = Date.now();
    for (const [jti, hasta] of this.usados) {
      if (hasta < ahora) this.usados.delete(jti);
    }
  }
}
