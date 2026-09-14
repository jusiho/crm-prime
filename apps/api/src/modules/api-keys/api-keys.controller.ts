import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  createApiKeySchema,
  updateApiKeySchema,
  Role,
  type AccessTokenClaims,
  type ApiKeyDto,
  type CreateApiKeyInput,
  type CreatedApiKey,
  type UpdateApiKeyInput,
} from "@crm/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ApiKeyService } from "./api-key.service";

// Gestión de las claves desde el dashboard: solo admin.
@Controller("api-keys")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ApiKeysController {
  constructor(private readonly keys: ApiKeyService) {}

  @Get()
  list(): Promise<ApiKeyDto[]> {
    return this.keys.list();
  }

  // Única respuesta que incluye el secreto completo.
  @Post()
  create(
    @Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKeyInput,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<CreatedApiKey> {
    return this.keys.create(body, user.sub);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateApiKeySchema)) body: UpdateApiKeyInput,
  ): Promise<ApiKeyDto> {
    return this.keys.update(id, body);
  }

  // Revocar deja la fila (y su rastro de uso); borrar la elimina del todo.
  @Post(":id/revoke")
  revoke(@Param("id") id: string): Promise<ApiKeyDto> {
    return this.keys.revoke(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string): Promise<{ ok: true }> {
    return this.keys.remove(id);
  }
}
