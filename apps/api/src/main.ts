import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger, RequestMethod } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { I18nExceptionFilter } from "./common/filters/i18n-exception.filter";
import { PublicApiModule } from "./modules/public-api/public-api.module";
import { corsOrigin } from "./common/utils/cors-origin";

async function bootstrap() {
  // rawBody: true expone req.rawBody para validar la firma del webhook de Meta.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Versionado de API: todo cuelga de /api/v1.
  // La API pública queda fuera: lleva su propia versión en la ruta
  // (/api/public/v1) para poder evolucionar sin arrastrar la interna.
  app.setGlobalPrefix("api/v1", {
    exclude: [{ path: "api/public/v1/(.*)", method: RequestMethod.ALL }],
  });

  // Traduce los mensajes de error según el idioma del cliente.
  app.useGlobalFilters(new I18nExceptionFilter());

  // CORS para la app móvil (la web pasa por su propio BFF en Next).
  app.enableCors({
    origin: corsOrigin(),
    credentials: true,
  });

  // Documentación interactiva SOLO de la API pública: lo interno cambia con
  // el producto y no es un contrato con nadie de fuera.
  const doc = new DocumentBuilder()
    .setTitle("Trimmo · API pública")
    .setDescription(
      "API para integrar sistemas externos (n8n, Zapier, un ERP) con el CRM. " +
        "Autentícate con una clave creada en **Ajustes › Claves de API** y " +
        "envíala como `Authorization: Bearer crm_…`. Cada endpoint exige un " +
        "ámbito concreto; si a la clave le falta, responde 403 diciendo cuál.",
    )
    .setVersion("1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", description: "Clave de API (crm_…)" },
      "apiKey",
    )
    .build();
  const document = SwaggerModule.createDocument(app, doc, {
    include: [PublicApiModule],
  });
  SwaggerModule.setup("api/docs", app, document, {
    customSiteTitle: "Trimmo · API",
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}/api/v1`, "Bootstrap");
  Logger.log(`Documentación de la API pública en http://localhost:${port}/api/docs`, "Bootstrap");
}

void bootstrap();
