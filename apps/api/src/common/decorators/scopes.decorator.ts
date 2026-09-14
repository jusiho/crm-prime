import { SetMetadata } from "@nestjs/common";
import type { ApiScope } from "@crm/shared";

export const SCOPES_KEY = "apiScopes";

/**
 * Ámbitos que debe tener la clave de API para usar el endpoint.
 * Uso: @Scopes("leads:write")
 */
export const Scopes = (...scopes: ApiScope[]) => SetMetadata(SCOPES_KEY, scopes);
