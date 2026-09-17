import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { resolveLocale, translateMessage } from "../../i18n/i18n";

/**
 * Traduce el mensaje de cada error al idioma que pide el cliente
 * (Accept-Language). Se hace aquí, en la frontera, para que los servicios
 * sigan lanzando errores sin saber nada de idiomas.
 */
@Catch()
export class I18nExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const locale = resolveLocale(req.headers["accept-language"]);

    if (!(exception instanceof HttpException)) {
      // Un fallo no previsto no se traduce ni se detalla: solo se registra.
      this.logger.error(
        `${req.method} ${req.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: translateMessage("Error interno del servidor", locale),
      });
      return;
    }

    const status = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === "string") {
      res.status(status).json({
        statusCode: status,
        message: translateMessage(body, locale),
      });
      return;
    }

    const payload = body as Record<string, unknown>;
    res.status(status).json({
      ...payload,
      ...(payload.message !== undefined
        ? { message: translateMessage(payload.message, locale) }
        : {}),
    });
  }
}
