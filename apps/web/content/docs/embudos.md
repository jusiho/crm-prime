# Embudos

Un embudo es un tablero de oportunidades con etapas. Puedes tener **varios** —Ventas, Soporte, Renovaciones— y cada número de WhatsApp decide a cuál entran sus conversaciones.

## Etapas

En **Ajustes › Embudos y etapas** creas embudos y, dentro de cada uno, sus etapas. Dos marcas especiales:

- **Ganada**: las oportunidades que llegan aquí cuentan como cerradas con éxito.
- **Perdida**: cerradas sin venta.

Uno de los embudos es el **predeterminado**: es el que usan el agente de IA, los leads de Meta y la API pública cuando no se indica otro.

## El tablero

En **Pipeline** ves el embudo con sus columnas. Arrastra las tarjetas de una etapa a otra, ábrelas para editar título, valor, vendedor y campos del lead, y márcalas como ganadas o perdidas. Con varios embudos, arriba aparece un selector con el número de oportunidades abiertas de cada uno.

Cada tarjeta muestra la **fuente** del contacto y el vendedor. La columna con el icono de bandeja es la **etapa de entrada** (ver abajo).

## Entrada automática desde WhatsApp

Es la manera recomendada de trabajar: que ninguna conversación se quede fuera del embudo.

Activa en el embudo **«Crear una oportunidad al primer mensaje de WhatsApp»** y elige:

- **Etapa de entrada**: donde aparecen (te recomendamos una primera etapa llamada *Entrantes*).
- **Días para descartar**: si el contacto no vuelve a escribir en ese plazo y nadie movió la oportunidad, se descarta sola (0 = nunca).
- **Números** cuyas conversaciones entran a este embudo.

Con eso, cuando escribe un contacto **sin ninguna oportunidad en curso**:

1. se crea una en la etapa de entrada, con el nombre del contacto y su fuente;
2. se asigna al **vendedor de esa fuente con menos oportunidades abiertas** (reparto parejo);
3. si el contacto ya tenía una oportunidad ganada o perdida, se abre una nueva; si tenía una en curso, no se duplica.

Las empresas nuevas traen esto activado en su embudo *Ventas*, con la etapa *Entrantes*.

## Descartar

No todo el que escribe quiere comprar. **Descartar** («no es una venta») saca la oportunidad del tablero sin borrarla: queda en **Descartadas**, sigue contando para las métricas y se puede restaurar. Si una oportunidad descartada por inactividad recibe un mensaje nuevo del contacto, **vuelve sola** a la etapa de entrada.

## Quién mueve las oportunidades

- **Tú**, arrastrando en el tablero.
- **El agente de IA**, con la acción *Mover en pipeline* cuando detecta intención (ver [Agentes](/docs/agentes)).
- **Un flujo**, con el bloque *Acción → Mover en pipeline* ([Flujos](/docs/flujos)).
- **Tu sistema**, por la [API pública](/docs/api), por nombre de etapa.

Cada cambio de etapa dispara el webhook `deal.stage_changed` si lo tienes suscrito.
