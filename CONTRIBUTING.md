# Contribuir a CRM Prime

Gracias por el interés. Este documento explica cómo está montado el repo y qué
se espera de un cambio para que entre.

## Antes de escribir código

- **Para un bug**, abre un issue con los pasos para reproducirlo, qué esperabas y
  qué pasó. Si es de WhatsApp o de la IA, incluye el log de la API: casi siempre
  el motivo real está ahí y no en pantalla.
- **Para una funcionalidad**, abre un issue antes de implementarla. Es más rápido
  discutir el enfoque en tres frases que en un pull request de 600 líneas.

## Montar el entorno

Está en el [README](./README.md#puesta-en-marcha). No necesitas credenciales de
WhatsApp ni de ninguna IA para desarrollar: los adaptadores simulados dejan el
CRM funcionando entero.

## Estructura

```
apps/api/src/modules/     un módulo por dominio (ai, messaging, whatsapp, pipeline…)
apps/api/src/infra/       prisma, colas, almacenamiento de archivos
apps/api/src/common/      guards, decorators, pipes, utilidades
apps/web/src/features/    un directorio por sección de la UI
apps/web/src/app/api/bff/ el BFF: reenvía a la API añadiendo el JWT de la cookie
packages/shared/src/      esquemas Zod y tipos (única fuente de validación)
```

Dos reglas de arquitectura que conviene respetar:

**La validación vive en `packages/shared`.** Un esquema Zod se escribe una vez y
lo usan la API (por el `ZodValidationPipe`) y la web. No dupliques validación en
el cliente.

**El navegador nunca ve el JWT.** La web habla con su propio BFF en
`/api/bff/*`, y ese BFF añade el token desde una cookie httpOnly al llamar a la
API. Si añades un endpoint, añade también su ruta en el BFF.

## Integraciones externas

WhatsApp, el LLM y el almacenamiento de archivos usan el patrón adaptador: una
interfaz y dos implementaciones (real y simulada). Si añades un proveedor:

1. Define o reutiliza la interfaz (`*-provider.interface.ts`).
2. Implementa **las dos** variantes. La simulada debe registrar en log y devolver
   algo coherente, nunca lanzar.
3. Resuelve las credenciales **en cada llamada**, no al arrancar. Así cambiar una
   key desde el panel surte efecto sin reiniciar.

## Base de datos

El historial de migraciones y la base de desarrollo pueden estar desalineados, y
`prisma migrate dev` propondrá resetear. Para un cambio aditivo:

```bash
# 1. Edita apps/api/prisma/schema.prisma
# 2. Escribe el SQL a mano y aplícalo
npx prisma db execute --schema apps/api/prisma/schema.prisma --file cambio.sql
# 3. Guárdalo también como migración para que db:deploy funcione en producción
mkdir -p apps/api/prisma/migrations/<timestamp>_<nombre>
cp cambio.sql apps/api/prisma/migrations/<timestamp>_<nombre>/migration.sql
# 4. Regenera el cliente
npx prisma generate --schema apps/api/prisma/schema.prisma
```

En Windows, `prisma generate` falla con `EPERM` si hay un proceso Node vivo
usando el cliente. Párales antes.

## Estilo

No hay un documento de estilo largo; el criterio es **que el código nuevo se lea
como el que ya está**. En la práctica:

- Comentarios en español, y solo donde aportan el *porqué*. Un comentario que
  repite lo que el código ya dice sobra.
- Nombres y mensajes de cara al usuario, en español.
- TypeScript estricto. `npm run typecheck` tiene que pasar limpio.
- Los mensajes de error que ve el usuario explican **qué hacer**, no solo qué
  falló.

Para la interfaz, el proyecto tiene un sistema de diseño documentado en
`DESIGN.md`. Lo esencial: superficie oscura, **un solo acento** (el verde de
marca) reservado para acción y estado vivo, iconos de línea del componente
`NavIcon` — nunca emojis como iconos de interfaz — y ningún estado comunicado
solo con color.

## Pull requests

- Una rama por cambio, desde `main`.
- Que `npm run typecheck` y `npm run lint` pasen.
- Describe **qué** cambia y **por qué**. Si es visual, adjunta captura.
- Si tocas el esquema de Prisma, incluye la migración.
- No mezcles un cambio funcional con un reformateo masivo: son imposibles de
  revisar juntos.

## Licencia

Al contribuir aceptas que tu código se publique bajo la
[AGPL-3.0](./LICENSE) del proyecto.
