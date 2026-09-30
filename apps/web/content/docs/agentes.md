# Agentes de IA

Un agente es un asistente configurado por ti que atiende las conversaciones: responde con tu información, califica al cliente y actúa sobre el CRM. Puedes tener varios (uno por número, por ejemplo) y uno **por defecto** para lo que no tenga agente propio.

## Tu API key

Los agentes usan **tu** cuenta del proveedor de modelos. En **Ajustes › Inteligencia Artificial**:

- **OpenAI** o **Anthropic (Claude)**: pega tu API key y elige el modelo por defecto.
- **Cualquier API compatible con OpenAI** (Groq, DeepSeek, OpenRouter, Ollama…): pon su URL base en el campo *URL base* de OpenAI, con la key y el modelo de ese servicio.
- Pulsa **Probar conexión**: hace una llamada real y te dice si funciona.

Las keys se guardan cifradas y solo las usa tu empresa. Cada respuesta se cobra en tu cuenta del proveedor.

## Crear un agente

En **Agentes IA → Nuevo agente**:

- **Instrucciones**: quién es, qué vende, cómo habla, qué no debe hacer. Es el texto más importante.
- **Modelo y esfuerzo**: un modelo rápido y barato para preguntas frecuentes; uno potente para ventas complejas. El esfuerzo regula cuánto "piensa" antes de responder.
- **Herramientas**: qué puede consultar y hacer (abajo).
- **Número**: el agente atiende ese número; sin número, es el de respaldo.
- **Autopilot por defecto**: las conversaciones nuevas arrancan respondiendo solas. Si no, arrancan en Copilot (ver [Bandeja](/docs/bandeja#copilot-y-autopilot)).
- **Bienvenida**, **horario** (fuera de horario responde un mensaje fijo) y **palabras clave** que disparan una acción.
- **Escalado**: umbrales de confianza y de enfado del cliente a partir de los cuales pasa a una persona.

## Asistente de redacción

No hace falta saber escribir un *system prompt*. Junto al campo de instrucciones (y junto a la bienvenida y al mensaje fuera de horario) hay un botón **Asistente**:

1. Cuentas qué vendes y a quién, el objetivo del agente (vender, agendar, dar soporte…) y el tono.
2. El asistente propone unas instrucciones completas: rol, objetivo, tono para WhatsApp, cuándo usar cada herramienta que tengas activada, límites, cuándo pasar a una persona y ejemplos.
3. Pides ajustes en el chat («más corto», «de usted», «añade los horarios») y, cuando te convenza, pulsas **Usar este texto**. Nada se guarda hasta que guardas el agente.

Usa tu propio modelo (Ajustes › Inteligencia Artificial) y conoce tu contexto real: catálogo, base de conocimiento, etapas del embudo y herramientas del agente, así que no inventa nombres de herramientas ni productos. Lo que no sabe lo deja marcado entre corchetes, como `[HORARIO]`, para que lo rellenes. También sirve para cualquier otro texto: un guion de ventas, una respuesta a una objeción o un mensaje de seguimiento.

## Herramientas y acciones

| Consulta | Qué hace |
|---|---|
| `search_knowledge` | Busca en tu [base de conocimiento](#base-de-conocimiento) |
| `search_products` | Busca en tu catálogo (Productos) |
| `search_contact` | Lee la ficha del contacto |

| Acción | Qué hace |
|---|---|
| `add_tag` / `remove_tag` | Etiqueta al contacto |
| `move_deal_stage` | Mueve (o crea) su oportunidad en el embudo predeterminado |
| `update_contact` | Actualiza la ficha y los campos personalizados |
| `assign_to_seller` | Asigna un vendedor |
| `send_product_image` | Envía la foto de un producto |
| `handoff_to_human` | Se rinde y pasa la conversación a una persona |

En Copilot las acciones quedan pendientes de aprobación; en Autopilot se aplican solas.

## Precios en varias monedas

Cada producto tiene un **precio base** y, si quieres, **precios en otras monedas** (Productos › Editar › *Añadir precio en otra moneda*, o columnas `precio_USD`, `precio_MXN`… al importar un CSV). No hay conversión automática: el precio en cada moneda lo decides tú.

A cada contacto se le cotiza en la moneda de **su país**, que Driony deduce del prefijo de su teléfono (+52 → México → MXN, +51 → Perú → PEN). Si hace falta otra, se cambia en su ficha (*País y moneda para cotizar*).

- El agente recibe los precios de `search_products` ya en la moneda del cliente. Si un producto no tiene precio en esa moneda, le da el precio base con su moneda, sin inventar una conversión.
- Las oportunidades nuevas nacen en la moneda del contacto, y se puede cambiar en su detalle. Cada columna del embudo suma por separado cada moneda.

## Base de conocimiento

En **Conocimiento** subes documentos (precios, condiciones, preguntas frecuentes, guías). Se trocean y se indexan para que el agente responda **con tu información** en vez de inventar. Cada consulta suma un poco de tiempo y de gasto; activa la herramienta solo en los agentes que la necesiten.

## Límite de gasto

Cada respuesta registra sus tokens y su coste. En el agente ves el gasto del mes y puedes poner un **tope mensual**: al alcanzarlo, la IA deja de responder con ese agente y las conversaciones pasan a tu equipo. Sin sorpresas en la factura del proveedor.

## Playground

Antes de activar un agente, pruébalo en el **Playground**: una conversación simulada donde ves la respuesta, las herramientas que usó, los tokens y el coste de cada turno.
