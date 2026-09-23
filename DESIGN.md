---
name: Trimmo
description: CRM para WhatsApp con agentes IA — la sala de control del vendedor
colors:
  accent: "#25d366"
  accent-soft: "#25d3661f"
  accent-ink: "#04210f"
  positive: "#7ee2a8"
  bg: "#0b0f17"
  surface: "#131a26"
  surface-raised: "#0f1726"
  sidebar: "#0d121d"
  field: "#0d1320"
  border: "#223049"
  ink: "#e6edf6"
  muted: "#8aa0bd"
  danger: "#e08a8a"
  warning: "#e0a458"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  overline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.6px"
rounded:
  control: "8px"
  surface: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.positive}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
---

# Design System: Trimmo

## 1. Overview

**Creative North Star: "La Sala de Control"**

Trimmo es el puesto de mando del vendedor: una superficie oscura y enfocada
donde toda la operación —conversaciones en vivo, oportunidades, campañas— está a
la vista y bajo control. El fondo casi negro azulado (#0b0f17) no es "dark mode
porque queda cool": es la sala con las luces bajas para que **lo que importa
brille**. Y lo que brilla es el **Verde Señal** (#25d366): el pulso del producto,
reservado para la acción y el estado vivo (en línea, entregado, IA activa, deal
ganado). El verde nunca decora; señala.

El sistema es **denso pero legible**: el vendedor maneja muchos hilos y tarjetas a
la vez, así que la información se empaqueta con jerarquía clara y aire suficiente,
nunca apretada ni ruidosa. La energía —porque la marca es moderna, enérgica,
viva— se expresa con **microinteracciones táctiles** (hover que aviva, pulsación
que hunde, entradas que aparecen) y con la presencia rítmica del verde, no con
saturación de color ni adorno.

Rechaza explícitamente tres cosas: el **SaaS genérico de plantilla** (tarjetas
clonadas, gris plano, "big number + label" de dashboard), lo **colorido/infantil**
(arcoíris y emojis por doquier) y lo **corporativo frío/anticuado** (azules
rígidos, tablas densas estilo software de los 2000). Si una pantalla pudiera ser
de cualquier otro SaaS, falló.

**Key Characteristics:**
- Sala oscura azulada; el contenido es la luz.
- Un solo acento con significado: Verde Señal = acción y vida.
- Densidad con jerarquía; aire que respira, nunca apretado.
- Energía por movimiento táctil, no por color saturado.
- Estados siempre explícitos (color + icono/texto), nunca solo color.

## 2. Colors

Paleta oscura azulada de una sola voz: neutros fríos como escenario y un verde
como única señal.

### Primary
- **Verde Señal** (#25d366): el ancla de identidad (herencia WhatsApp). Exclusivo
  para acción y estado vivo: botón primario, confirmaciones, métricas positivas,
  punto de "en tiempo real", deal ganado, IA activa. Su rareza es lo que lo hace
  leer como señal.
- **Verde Señal Tenue** (#25d3661f): el verde a 12% como fondo de selección — ítem
  de navegación activo, chips de estado positivo. Tinte, no bloque.
- **Tinta Verde** (#04210f): el texto casi negro que va **sobre** el Verde Señal
  (botones primarios). Garantiza contraste AA sobre el verde brillante.

### Secondary
- **Verde Vital** (#7ee2a8): verde claro para texto/acento positivo sobre fondo
  oscuro (totales del pipeline, "opt-in: sí", confirmaciones discretas). Es el eco
  legible del acento cuando el verde brillante no daría contraste como texto.

### Neutral
- **Fondo Sala** (#0b0f17): el lienzo, casi negro azulado. La sala con luz baja.
- **Superficie** (#131a26): paneles y tarjetas que se levantan del fondo.
- **Superficie Honda** (#0f1726): superficie ligeramente más baja para nodos del
  constructor de flujos y zonas internas.
- **Barra Lateral** (#0d121d): la navegación, un punto más oscura que el fondo.
- **Campo** (#0d1320): el interior de inputs, selects y textareas; más hondo que la
  superficie para leerse como "hueco donde se escribe".
- **Borde** (#223049): hairline azulado para estructura y divisores.
- **Tinta** (#e6edf6): texto principal. Contraste alto sobre todas las superficies.
- **Tinta Apagada** (#8aa0bd): texto secundario, etiquetas, metadatos. Azul-gris,
  no gris muerto.

### Tertiary (estados)
- **Ámbar** (#e0a458): advertencia / pendiente (conversación PENDING, etapa
  programada).
- **Rojo Suave** (#e08a8a): error, perder un deal, opt-out, acciones destructivas.

### Named Rules
**La Regla de la Única Señal.** El Verde Señal aparece en ≤10% de cualquier
pantalla. Es para acción y vida, jamás para rellenar. Si dos cosas verdes compiten
por atención, una de las dos no debería ser verde.

**La Regla del Estado Doble.** Ningún estado se comunica solo con color. Entregado,
ganado, perdido, pausado: siempre color **+** icono o palabra. El daltónico y el
apurado leen lo mismo.

## 3. Typography

**Display Font:** ninguna. Es una herramienta, no una portada.
**Body Font:** stack de sistema (ui-sans-serif, system-ui, -apple-system, "Segoe
UI", Roboto). Rápida, nativa, sin coste de carga — el vendedor abre y trabaja.
**Label/Mono Font:** el mismo stack; el peso y el tamaño hacen la jerarquía.

**Character:** una sola familia sans del sistema en varios pesos (400/600/700). La
jerarquía la cargan el tamaño y el peso, no el contraste de fuentes. Sobria,
operativa, sin personalidad tipográfica que distraiga del dato.

### Hierarchy
- **Headline** (700, 20px, 1.2, -0.01em): título de página en la cabecera del
  AppShell ("Bandeja", "Pipeline").
- **Title** (700, 16px, 1.3): títulos de sección, de tarjeta y de panel/drawer.
- **Body** (400, 14px, 1.5): texto general, contenido de mensajes, filas de tabla.
  Cuerpos de texto largo a 65–75ch.
- **Label** (600, 12px): etiquetas de formulario, metadatos, subtítulo de cabecera.
- **Overline** (600, 11px, +0.6px tracking, mayúsculas): **solo** los rótulos de
  grupo de la barra lateral ("Ventas", "Automatización"). Es un sistema de
  navegación deliberado, no un eyebrow decorativo sobre cada sección.

### Named Rules
**La Regla del Peso Antes que la Fuente.** La jerarquía se hace con tamaño y peso
en una sola familia. Prohibido emparejar dos sans parecidas para "dar variedad".

**La Regla del Overline Confinado.** Las mayúsculas tracked viven únicamente en los
rótulos de grupo del nav. Nunca como eyebrow sobre encabezados de contenido.

## 4. Elevation

Sistema **elevado**: las superficies se levantan del fondo con sombra suave, no
solo con borde. La profundidad es jerárquica — barra lateral (más baja) → fondo →
tarjeta (levantada) → overlay (flotando alto) — y refuerza qué está "encima" de
qué. La luz baja de la sala hace que una sombra discreta ya lea como relieve.

### Shadow Vocabulary
- **Lift de tarjeta** (`box-shadow: 0 1px 2px rgba(0,0,0,.35), 0 6px 14px rgba(0,0,0,.22)`):
  tarjetas y paneles en reposo. Levanta sin gritar (blur ≤ 14px).
- **Sombra de overlay** (`box-shadow: 0 6px 20px rgba(0,0,0,.45)`): menús, dropdown
  del "+" de flujos, popovers.
- **Sombra de drawer** (`box-shadow: -8px 0 24px rgba(0,0,0,.4)`): paneles
  laterales (detalle de deal, configuración de bot, sesiones).

### Named Rules
**La Regla Anti Ghost-Card.** Cuando una tarjeta se eleva con sombra, su borde baja
a hairline o desaparece: el relieve lo carga la sombra, no un borde+sombra
compitiendo. Nunca `border: 1px solid` junto a una sombra de blur ≥ 16px.

**La Regla de la Sombra Jerárquica.** La fuerza de la sombra crece con la altura:
tarjeta < overlay < drawer < modal. Una sombra fuerte en algo que no flota miente
sobre su posición.

## 5. Components

Carácter general: **táctil y enérgico**. Bordes y superficies definidos, respuesta
inmediata y viva al cursor (el hover aviva, la pulsación hunde), sin floritura. Se
siente una herramienta de trabajo que responde al instante.

### Buttons
- **Shape:** esquinas suaves (8px, `{rounded.control}`).
- **Primary:** fondo Verde Señal (#25d366), texto Tinta Verde (#04210f), peso 600,
  padding 9px 16px. Para la acción principal de cada vista.
- **Hover / Focus:** hover sube el brillo (`filter: brightness(1.08)`); `:active`
  hunde 1px (`translateY(1px)`); foco de teclado con anillo de acento (outline 2px
  #25d366, offset 2px). Transición 0.13s.
- **Ghost:** fondo transparente, borde Borde (#223049), texto Tinta Apagada; para
  acciones secundarias (Cancelar, Editar). Destructivo: texto/borde Rojo Suave.

### Chips
- **Style:** pastilla (radio 999px), texto 11–13px. Estado positivo = Verde Señal
  Tenue + Verde Vital. Etiquetas/fuentes = su propio color de fondo a tono pleno.
- **State:** filtro seleccionado = fondo acento tenue + borde acento; no
  seleccionado = transparente + borde Borde, opacidad reducida.

### Cards / Containers
- **Corner Style:** 12px (`{rounded.surface}`).
- **Background:** Superficie (#131a26) sobre el Fondo Sala.
- **Shadow Strategy:** Lift de tarjeta (ver Elevation). Borde a hairline o ausente
  cuando la sombra ya separa.
- **Border:** Borde (#223049) de 1px solo cuando no hay sombra que separe.
- **Internal Padding:** 16px (`{spacing.lg}`).

### Inputs / Fields
- **Style:** fondo Campo (#0d1320) más hondo que la superficie, borde Borde,
  radio 8px, texto Tinta. Placeholder #5d6e88 (legible, no gris fantasma).
- **Focus:** anillo de acento por `outline` (2px #25d366, offset 2px) — no pelea
  con el borde inline. Caret en Verde Señal.
- **Error / Disabled:** error con borde/acento Rojo Suave; disabled a 55% de
  opacidad y cursor `not-allowed`.

### Navigation
- **Style:** barra lateral fija (226px) sobre #0d121d, agrupada por rótulos
  Overline. Ítem = icono de línea (18px, trazo 1.75) + etiqueta 14px/500.
- **States:** default Tinta Apagada; hover sube a Tinta + fondo #16202f; **activo**
  = fondo Verde Señal Tenue + texto claro + **barra de acento de 3px** pegada al
  borde izquierdo. Móvil: la barra debería colapsar (pendiente).

### Burbuja de mensaje (componente firma)
El corazón de la bandeja. Saliente = fondo verde profundo (#155e3b) alineado a la
derecha; entrante = #1c2738 a la izquierda. Reacción como pastilla flotante en el
borde inferior. Acción de reaccionar aparece al hacer hover (no satura en reposo).
Estado de envío (enviado/entregado/leído) en texto pequeño Verde Vital.

## 6. Do's and Don'ts

### Do:
- **Do** reservar el Verde Señal (#25d366) para acción y estado vivo; ≤10% de la
  pantalla (La Regla de la Única Señal).
- **Do** comunicar todo estado con color **+** icono o palabra (La Regla del Estado
  Doble): entregado, ganado, perdido, IA pausada.
- **Do** elevar tarjetas con sombra suave (blur ≤ 14px) y bajar el borde a hairline
  o quitarlo cuando la sombra ya separa.
- **Do** dar respuesta táctil: hover que sube brillo, `:active` que hunde 1px,
  anillo de foco de acento por `outline`.
- **Do** mantener una sola familia sans del sistema; jerarquía por tamaño y peso.
- **Do** texto de cuerpo a ≥4.5:1; placeholders legibles (#5d6e88), nunca gris
  fantasma.

### Don't:
- **Don't** caer en **SaaS genérico de plantilla**: rejillas de tarjetas idénticas,
  todo gris, el template "big number + label" de dashboard.
- **Don't** volverlo **colorido/infantil**: arcoíris de colores ni emojis por todos
  lados; la energía va por movimiento y el acento, no por ruido.
- **Don't** parecer **corporativo frío/anticuado**: azules corporativos rígidos ni
  tablas densas estilo software de los 2000.
- **Don't** parear `border: 1px solid` con `box-shadow` de blur ≥ 16px en la misma
  tarjeta o botón (ghost-card). Elige uno.
- **Don't** redondear tarjetas/inputs a 24/28/32px+. El techo es 12px en superficies
  (full-pill solo en chips/badges).
- **Don't** usar el verde como relleno decorativo, gradientes de texto, ni
  glassmorphism por defecto.
- **Don't** sacar las mayúsculas tracked del nav: nada de eyebrow sobre cada sección.
