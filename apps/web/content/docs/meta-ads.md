# Anuncios y leads de Meta

Trimmo recoge los contactos que llegan desde Facebook e Instagram por dos caminos, y guarda de dónde vino cada uno.

## Anuncios click-to-WhatsApp

Son los anuncios cuyo botón abre una conversación de WhatsApp. No hay que configurar nada: cuando el primer mensaje llega desde un anuncio, Trimmo lo detecta y guarda en el contacto:

- **Procedencia**: *anuncio*, con el titular y el identificador del anuncio;
- la **fuente** «Anuncio de Meta»;
- los parámetros **utm_*** que pongas en la URL del anuncio o en el texto prellenado del enlace `wa.me`;
- el **ctwa_clid**, el identificador del clic que Meta usa para atribuir conversiones.

Todo eso se ve en la ficha del contacto y sale por la [API pública](/docs/api) (`origin`, `utm`).

## Lead Ads (formularios)

Los formularios de clientes potenciales de Facebook e Instagram entran al CRM en el momento en que alguien los envía:

1. **Ajustes › Leads de Meta → Conectar página**: autoriza con la cuenta que administra la página.
2. Elige la **fuente** que reciben esos leads y, si quieres, una **plantilla de bienvenida**: como el lead no te ha escrito, la ventana de 24 horas está cerrada y solo una plantilla aprobada puede abrir la conversación.
3. Cada lead crea (o actualiza) el contacto con las respuestas del formulario y una oportunidad en la primera etapa del embudo predeterminado.

En **Leads de Meta** ves cada lead recibido, su formulario y si se procesó bien.

## Atribución en tus métricas

En la ficha del contacto distinguimos dos cosas:

- **Fuente**: comercial, la que tú defines y usas para repartir vendedores (Ajustes › Fuentes).
- **Procedencia**: técnica, por qué vía entró (anuncio, WhatsApp, webhook, importación) y con qué detalle (número, nombre de la clave de API, anuncio).

Con la API `stats/*` puedes cruzar fuente, embudo y vendedor en tu propio panel.

## Conversiones de vuelta a Meta

Trimmo guarda los identificadores que Meta necesita para atribuir resultados a los anuncios: el `ctwa_clid` de cada conversación que vino de un anuncio y el `lead_id` de cada lead de formulario. Con ellos se pueden enviar a Meta las etapas del embudo (lead calificado, venta ganada) mediante la Conversions API, para que las campañas optimicen hacia clientes de verdad y no solo hacia clics. Si te interesa configurarlo, escríbenos.
