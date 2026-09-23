import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import {
  loginSchema,
  registerSchema,
  refreshSchema,
  logoutSchema,
  updateProfileSchema,
  changePasswordSchema,
  type LoginInput,
  type RegisterInput,
  type RefreshInput,
  type LogoutInput,
  type UpdateProfileInput,
  type ChangePasswordInput,
  type AccessTokenClaims,
} from "@crm/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @HttpCode(201)
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ) {
    return this.auth.register(body);
  }

  @Post("login")
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
  ) {
    // De dónde sale el subdominio, por orden:
    //
    // 1. Del cuerpo, que es lo normal: la petición llega desde el servidor de
    //    Next (patrón BFF), así que el `Host` que vemos aquí es el suyo, no el
    //    del navegador. Quien conoce el subdominio real es el middleware de
    //    Next, y lo manda explícito.
    // 2. Del `Host`, para quien llame directo a la API (una app móvil contra
    //    `acme.trimmo.lat`).
    //
    // Aceptarlo del cuerpo es seguro porque **solo elige a quién buscar**. Sin
    // la contraseña no se entra, y el `orgId` del token sale de la fila del
    // usuario. Pedir que te busquen en otra empresa no te da nada.
    const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "");
    const orgSlug = body.orgSlug ?? subdominioDe(host);

    return this.auth.login({ ...body, orgSlug }, {
      platform: body.platform,
      deviceName: body.deviceName,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(logoutSchema)) body: LogoutInput,
  ): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  // ── Perfil de la cuenta ────────────────────────────────────
  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AccessTokenClaims) {
    return this.auth.getMe(user.sub);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @CurrentUser() user: AccessTokenClaims,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.auth.updateProfile(user.sub, body.name);
  }

  @Post("change-password")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: AccessTokenClaims,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ): Promise<void> {
    await this.auth.changePassword(
      user.sub,
      body.currentPassword,
      body.newPassword,
      user.sid,
    );
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  sessions(@CurrentUser() user: AccessTokenClaims) {
    return this.auth.listSessions(user.sub, user.sid);
  }

  // Cierra todas las demás sesiones (deja viva solo la actual).
  @Delete("sessions")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async revokeOtherSessions(
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<void> {
    await this.auth.revokeOtherSessions(user.sub, user.sid);
  }

  @Delete("sessions/:id")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async revokeSession(
    @CurrentUser() user: AccessTokenClaims,
    @Param("id") id: string,
  ): Promise<void> {
    await this.auth.revokeUserSession(user.sub, id);
  }

  @Get("realtime-token")
  @UseGuards(JwtAuthGuard)
  async realtimeToken(@CurrentUser() user: AccessTokenClaims) {
    return { token: await this.auth.issueRealtimeToken(user) };
  }
}

/**
 * Saca el subdominio de un `Host`, o `undefined` si no lo hay.
 *
 * `acme.trimmo.lat` → "acme". `trimmo.lat`, `www.trimmo.lat` y
 * `localhost:3001` → undefined, que significa "no hay empresa en la URL".
 */
function subdominioDe(host: string): string | undefined {
  const limpio = host.split(":")[0]?.toLowerCase() ?? "";
  const base = (process.env.SAAS_BASE_DOMAIN ?? "").split(":")[0]?.toLowerCase();
  if (!base || !limpio.endsWith(`.${base}`)) return undefined;
  const slug = limpio.slice(0, -(base.length + 1));
  // Un solo nivel: el certificado comodín tampoco cubre más.
  if (!slug || slug.includes(".") || slug === "www") return undefined;
  return slug;
}
