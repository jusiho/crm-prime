# Bandeja

La bandeja reúne todas las conversaciones de todos tus números, en tiempo real. Cada conversación tiene un dueño, etiquetas, notas y un modo de IA.

## Moverse por la bandeja

- **Filtros**: *Cualquiera*, *Sin responder* (el cliente escribió y nadie ha contestado) y *Respondidas*. Además puedes filtrar por número, por vendedor y por etiqueta.
- **Asignación**: cada conversación tiene un dueño. Un vendedor ve las conversaciones de sus [fuentes](/docs/empezar#fuentes-y-reparto) y las que le asignen; un administrador las ve todas.
- **Etiquetas** (Ajustes › Etiquetas): para segmentar contactos y, después, para las [difusiones](/docs/difusiones).
- **Notas**: internas, no las ve el cliente.
- **Respuestas rápidas** (Ajustes › Respuestas rápidas): textos guardados que insertas con un clic.
- **Archivos**: imágenes, documentos, audio y ubicación, en los dos sentidos.

Cuando la conversación lleva más de 24 horas sin mensaje del cliente, el cuadro de respuesta te avisa y te ofrece enviar una **plantilla** aprobada.

## Copilot y Autopilot

El interruptor de arriba de cada conversación elige cómo trabaja el [agente de IA](/docs/agentes) en ella:

| | Copilot | Autopilot |
|---|---|---|
| Qué hace la IA | Redacta una **respuesta sugerida** y propone acciones | **Envía** la respuesta y aplica las acciones |
| Quién decide | Una persona aprueba, edita o descarta | La IA, dentro de los límites del agente |
| Cuándo pasa a una persona | Siempre está en manos de una persona | Cuando no está segura, el cliente se enfada o aparece una palabra clave que hayas definido |

Copilot es el modo por defecto. Cada agente decide con cuál arrancan las conversaciones nuevas (*Autopilot por defecto*).

Cuando alguien del equipo responde a mano —desde el CRM o desde el celular con Coexistencia—, **la IA se pausa** en esa conversación durante unos minutos.

## Acciones de la IA

Además de escribir, el agente puede **actuar sobre el CRM**: poner o quitar etiquetas, mover la oportunidad de etapa, actualizar la ficha del contacto, asignar un vendedor o enviar la foto de un producto. En Copilot esas acciones quedan **pendientes** y solo se aplican cuando envías la respuesta; si la descartas, no pasa nada.

## Escalado a humano

Cuando la IA se rinde («pasar a humano») la conversación pasa a Copilot y queda marcada como pendiente, con el motivo. Si tienes [webhooks salientes](/docs/webhooks), se dispara `conversation.escalated`.

## Baja del cliente

Si un contacto escribe **BAJA**, **STOP** o **CANCELAR**, queda marcado como *sin consentimiento* (opt-in desactivado) y las difusiones no le llegan. Puedes revertirlo desde su ficha.
