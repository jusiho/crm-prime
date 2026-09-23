import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { tenantStorage } from "./tenant.context";

/**
 * Abre el contenedor de contexto al principio de cada petición.
 *
 * Va vacío: en este punto los guardias todavía no han corrido, así que no se
 * sabe quién llama. Lo rellena `TenantInterceptor` un paso después, mutando
 * **este mismo objeto**.
 *
 * El reparto en dos piezas no es un capricho. `AsyncLocalStorage.run()` desde
 * un interceptor no serviría: envuelve la *creación* del Observable, no su
 * ejecución, y el contexto se habría perdido para cuando corre el handler.
 * Un middleware sí envuelve toda la petición, que es lo que hace falta.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    tenantStorage.run({ orgId: null }, () => next());
  }
}
