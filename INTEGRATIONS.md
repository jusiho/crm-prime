# Integrar con Trimmo

Dos caminos, y normalmente se usan los dos a la vez:

- **API pública** — tu sistema *llama* al CRM para leer o escribir.
- **Webhooks salientes** — el CRM *avisa* a tu sistema cuando pasa algo.

Documentación interactiva de todos los endpoints, con "probar" desde el
navegador: **`http://localhost:3001/api/docs`** (en tu despliegue, `/api/docs`).

---

## 1. Conseguir una clave

**Ajustes › Claves de API → Nueva clave.** Elige solo los permisos que la
integración necesite; una landing que crea leads no tiene por qué poder leer
tu base de contactos entera.

| Ámbito | Permite |
|---|---|
| `leads:write` | Crear leads por el webhook de entrada |
| `contacts:read` | Listar y leer contactos |
| `contacts:write` | Crear y editar contactos |
| `deals:write` | Crear oportunidades y moverlas de etapa |
| `messages:send` | Enviar mensajes de WhatsApp |
| `analytics:read` | Consultar métricas agregadas |

La clave se muestra **una sola vez**. Si la pierdes, crea otra y revoca la
anterior; se guarda solo su hash.

```bash
curl https://tu-crm/api/public/v1/ping \
  -H "Authorization: Bearer crm_a1b2c3d4_…"
# { "ok": true, "key": "n8n-pedidos", "scopes": ["contacts:write"] }
```

`ping` es la forma de comprobar clave y permisos sin escribir nada.

---

## 2. API pública

Base: `https://tu-crm/api/public/v1`. Autenticación por
`Authorization: Bearer crm_…` (también se acepta `x-api-key`).

La versión va en la ruta: cuando exista `v2`, `v1` seguirá funcionando.

### Contactos

```bash
# Listar, con filtros y paginación por cursor
curl "https://tu-crm/api/public/v1/contacts?limit=50&tag=interesado" \
  -H "Authorization: Bearer $CRM_KEY"
```

```json
{
  "data": [
    {
      "id": "cmu0…",
      "phone": "+51999888777",
      "name": "Ana",
      "tags": ["interesado"],
      "origin": "ad",
      "fields": { "pais": "Peru" },
      "utm": { "utm_source": "facebook", "utm_campaign": "verano2026" }
    }
  ],
  "nextCursor": "cmu0…",
  "hasMore": true
}
```

Para la página siguiente, pasa `nextCursor` como `cursor`. Se usa cursor y no
`offset` porque la lista crece por arriba: con offset se repiten o se saltan
registros entre páginas.

```bash
# Crear
curl -X POST https://tu-crm/api/public/v1/contacts \
  -H "Authorization: Bearer $CRM_KEY" -H "Content-Type: application/json" \
  -d '{"phone":"51999888777","name":"Ana","tags":["erp"],"fields":{"pais":"Peru"}}'

# Actualizar (los campos se fusionan; `tags` reemplaza el juego entero)
curl -X PATCH https://tu-crm/api/public/v1/contacts/cmu0… \
  -H "Authorization: Bearer $CRM_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Ana Pérez","fields":{"ciudad":"Lima"}}'
```

El teléfono se normaliza a E.164, así que da igual si lo mandas como
`51999888777`, `+51 999 888 777` o `0051999888777`.

### Oportunidades

```bash
# Crear (si el contacto no existe, se crea)
curl -X POST https://tu-crm/api/public/v1/deals \
  -H "Authorization: Bearer $CRM_KEY" -H "Content-Type: application/json" \
  -d '{"phone":"51999888777","title":"Pedido #4821","value":1250,"currency":"PEN"}'

# Mover de etapa, por NOMBRE
curl -X PATCH https://tu-crm/api/public/v1/deals/cmu0…/stage \
  -H "Authorization: Bearer $CRM_KEY" -H "Content-Type: application/json" \
  -d '{"stage":"Ganado"}'
```

Se trabaja con el **nombre** de la etapa, no con su id: tu sistema no tiene por
qué conocer los identificadores internos. Si el nombre no existe, el error te
dice cuáles hay.

### Mensajes

```bash
curl -X POST https://tu-crm/api/public/v1/messages \
  -H "Authorization: Bearer $CRM_KEY" -H "Content-Type: application/json" \
  -d '{"phone":"51999888777","text":"Tu pedido salió hoy 📦"}'
```

**Limitación de WhatsApp, no del CRM:** solo puedes escribir a quien te haya
escrito en las últimas 24 h. Fuera de esa ventana hay que usar una plantilla
aprobada por Meta (desde Campañas). Si no hay conversación abierta, la API
responde `400` explicándolo.

### Métricas

```bash
curl "https://tu-crm/api/public/v1/stats/summary?days=30" -H "Authorization: Bearer $CRM_KEY"
curl  https://tu-crm/api/public/v1/stats/funnel        -H "Authorization: Bearer $CRM_KEY"
curl  https://tu-crm/api/public/v1/stats/sellers       -H "Authorization: Bearer $CRM_KEY"
```

Pensados para alimentar un Metabase, un Looker o un panel propio.

### Errores

Formato uniforme, con el motivo en español:

| Código | Qué pasó |
|---|---|
| `400` | Datos inválidos. `message` es una lista con el campo y el problema |
| `401` | Clave ausente, inválida o revocada |
| `403` | La clave no tiene el ámbito necesario. Dice cuál falta |
| `404` | El recurso no existe |

```json
{ "message": "La clave \"solo-metricas\" no tiene permiso para esto (falta: contacts:write)",
  "error": "Forbidden", "statusCode": 403 }
```

---

## 3. Webhooks salientes

**Ajustes › Webhooks salientes → Nuevo.** Pon la URL de tu sistema y marca los
eventos que te interesan.

| Evento | Cuándo se dispara |
|---|---|
| `message.received` | Entra un mensaje de un cliente |
| `message.sent` | El CRM envía un mensaje |
| `contact.created` | Se crea un contacto |
| `deal.created` | Se crea una oportunidad |
| `deal.stage_changed` | Una oportunidad cambia de etapa |
| `conversation.escalated` | La IA se rinde y pasa el chat a un humano |

El CRM manda un `POST` con este cuerpo:

```json
{
  "event": "contact.created",
  "occurredAt": "2026-09-14T10:32:11.482Z",
  "data": { "contact": { "id": "cmu0…", "phone": "+51999888777" } }
}
```

y estas cabeceras:

```
X-CRM-Event:     contact.created
X-CRM-Signature: sha256=3f2a…
```

### Verifica la firma

Es lo que distingue un aviso real de cualquiera que descubra tu URL. Calcula el
HMAC-SHA256 del **cuerpo exacto** con el secreto de la suscripción y compáralo
en tiempo constante:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verificar(cuerpoCrudo, firmaRecibida, secreto) {
  const esperada =
    "sha256=" + createHmac("sha256", secreto).update(cuerpoCrudo).digest("hex");
  const a = Buffer.from(esperada);
  const b = Buffer.from(firmaRecibida);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Usa el cuerpo **sin parsear**: si lo conviertes a objeto y lo vuelves a
serializar, cambia un espacio y la firma deja de cuadrar.

### Reintentos

Si tu endpoint no responde `2xx`, el CRM reintenta **5 veces con espera
creciente** (1 min, 2, 4, 8, 16). El panel muestra el último código HTTP, el
error y los contadores de entregas y fallos.

Un webhook que falle **nunca afecta a la operación del CRM**: el envío va en
cola aparte y no bloquea nada.

### Conectar n8n

1. En n8n, nodo **Webhook**, método `POST`. Copia su URL de producción.
2. En el CRM, **Ajustes › Webhooks salientes → Nuevo**, pega esa URL y marca
   los eventos.
3. Pulsa **Probar**: te confirma al momento si n8n respondió.
4. Para verificar la firma en n8n, un nodo **Code** con la función de arriba.

---

## 4. Recibir leads (el camino más corto)

Si solo quieres meter leads desde una landing o un formulario, no necesitas
nada de lo anterior: con `leads:write` basta.

```bash
curl -X POST https://tu-crm/api/v1/webhooks/lead \
  -H "Authorization: Bearer $CRM_KEY" -H "Content-Type: application/json" \
  -d '{"phone":"51999888777","name":"Ana","source":"Facebook Ads",
       "tags":["nuevo"],"fields":{"ciudad":"Lima"}}'
```

El nombre de la clave queda registrado como procedencia del contacto, así que
sabes qué integración lo creó **sin fiarte de lo que declare quien llama**.
