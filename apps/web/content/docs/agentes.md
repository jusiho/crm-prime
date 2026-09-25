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

## Base de conocimiento

En **Conocimiento** subes documentos (precios, condiciones, preguntas frecuentes, guías). Se trocean y se indexan para que el agente responda **con tu información** en vez de inventar. Cada consulta suma un poco de tiempo y de gasto; activa la herramienta solo en los agentes que la necesiten.

## Límite de gasto

Cada respuesta registra sus tokens y su coste. En el agente ves el gasto del mes y puedes poner un **tope mensual**: al alcanzarlo, la IA deja de responder con ese agente y las conversaciones pasan a tu equipo. Sin sorpresas en la factura del proveedor.

## Playground

Antes de activar un agente, pruébalo en el **Playground**: una conversación simulada donde ves la respuesta, las herramientas que usó, los tokens y el coste de cada turno.
