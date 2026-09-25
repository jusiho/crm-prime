# Flujos

Un flujo es una automatización paso a paso: «cuando pase esto, envía esto, pregunta aquello y según la respuesta haz tal cosa». Se construye arrastrando bloques en un lienzo, sin código. Son ideales para lo que es siempre igual (bienvenida, menú, recogida de datos); para lo que requiere conversación de verdad, un [agente de IA](/docs/agentes).

## Disparadores

- **Al iniciar chat**: cuando un contacto escribe por primera vez (o abre una conversación nueva).
- **Por palabra clave**: cuando el mensaje contiene alguna de las palabras que definas (`hola, info, precio`).

Cada flujo puede aplicar a **un número** o a todos, y hay que marcarlo **Activo** para que corra. Un flujo con avisos no se puede activar hasta corregirlos.

## Bloques

| Bloque | Para qué |
|---|---|
| **Enviar mensaje** | Un texto al contacto. Admite variables: `{{nombre_variable}}`. |
| **Preguntar y guardar** | Envía una pregunta, espera la respuesta y la guarda en una variable. |
| **Condición** | Ramifica según palabras clave del último mensaje. Cada rama es una salida; *en otro caso* es la salida por defecto. Gana la primera rama que coincide, en orden. |
| **Acción** | Pasar al agente de IA, pasar a humano, poner etiqueta o mover en el embudo. |
| **Esperar** | Pausa de minutos u horas. Si el contacto escribe durante la espera, el flujo sigue con su mensaje. |
| **Petición HTTP** | Llama a una API o a n8n (GET/POST…), con cabeceras y cuerpo; puede guardar la respuesta en una variable. |
| **Asignar a agente** | Asigna la conversación a una persona del equipo. |
| **Ir a otro flujo** | Continúa en otro flujo. No tiene salida. |

## Variables

Las crean los bloques **Preguntar y guardar** y **Petición HTTP** (*guardar respuesta en*). Se usan en cualquier texto como `{{nombre_de_la_variable}}`. En el panel de cada bloque de texto aparecen las variables del flujo para insertarlas con un clic.

## El editor

- **«+» en cada salida**: añade el siguiente bloque ya conectado. En una conexión, su «+» inserta un bloque en medio y «×» la quita.
- **Paleta**: clic para añadir en el centro, o arrastra al lienzo.
- **Conectar a mano**: arrastra desde el punto ● de una salida hasta la entrada de otro bloque. Una salida solo puede tener una conexión.
- **Deshacer / rehacer** (Ctrl+Z / Ctrl+Shift+Z), **duplicar** (Ctrl+D), **eliminar** (Supr), **guardar** (Ctrl+S) y **Ordenar**, que recoloca todo por niveles.
- **Avisos**: cada bloque marca lo que le falta (texto, variable, URL…); el botón de avisos lista todos y te lleva al bloque.

## Asistente

El botón **Asistente** construye o modifica el flujo a partir de una descripción en lenguaje natural («un menú con tres opciones: precios, soporte y hablar con alguien»). Lo que propone se aplica al lienzo y se puede deshacer.
