---
target: landing pública (apps/web/src/features/marketing)
total_score: 22
p0_count: 1
p1_count: 3
timestamp: 2026-09-26T18-09-58Z
slug: apps-web-src-features-marketing-landing-tsx
---
# Crítica de diseño: landing pública de Trimmo

Objetivo: `apps/web/src/features/marketing/Landing.tsx` + `landing.css` (registro de marca). Evidencia: revisión de diseño independiente con inspección visual a 1440, 1024 y 390 px, más detector determinista en CLI y en navegador.

## Design Health Score

| # | Heurística | Puntuación | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado del sistema | 2 | Los enlaces del nav («Cómo funciona», «Por qué») aterrizan con el título escondido bajo el nav pegajoso (h2 a 53 px, nav hasta 67 px; sin `scroll-margin-top`). Sin estado activo en el nav. Las tarjetas se elevan y brillan al pasar el cursor sin ser pulsables. |
| 2 | Correspondencia con el mundo real | 2 | «Enterprise · en la nube» etiqueta el plan que «empieza gratis, sin tarjeta». `<html lang="en">` y `<title>` en inglés sobre una página en español. «Por qué» y «Ediciones» como rótulos. |
| 3 | Control y libertad | 3 | La marquesina solo se pausa con hover: sin pausa en táctil ni teclado (WCAG 2.2.2). Sin skip-link. |
| 4 | Consistencia y estándares | 1 | La landing incumple cuatro reglas nombradas de su propio DESIGN.md (titular sólido, overline confinado, cristal estructural, anti ghost-card). Dos sistemas tipográficos: Bricolage + Hanken en la landing, Space Grotesk + Inter en `/register`. `--ok: #4ade80` fuera de los tokens. Radio de tarjeta 14 px frente a 12 px. |
| 5 | Prevención de errores | 3 | En móvil el header solo ofrece «Empezar gratis»: el cliente que quiere entrar acaba en el registro. |
| 6 | Reconocimiento antes que recuerdo | 2 | Los rótulos del nav no coinciden con los títulos a los que llevan (Producto → «Capacidades», Open source → «Ediciones»). «Copilot o Autopilot», «API compatible», «AGPL» sin definir. |
| 7 | Flexibilidad y eficiencia | 2 | Móvil sin menú: `.lp-burger` nunca se muestra y el estado `menuOpen` es código muerto. El login más cercano está a unos 7.600 px de scroll. |
| 8 | Diseño estético y minimalista | 2 | «Open source» seis veces; 7 tarjetas + 3 pasos + 5+5 filas + 5+5 filas; 19 superficies con desenfoque; una tarjeta con unos 90 px de vacío. |
| 9 | Recuperación de errores | 3 | Nada falla (todas las rutas responden), pero tampoco hay nada que ayude. Aplica poco. |
| 10 | Ayuda y documentación | 2 | Hay «Docs», pero sin FAQ, sin precio, sin límites del plan gratis, sin contacto («Soporte de personas…» no lleva a ningún sitio). |
| **Total** | | **22/40** | **Aceptable: hacen falta mejoras significativas** |

## Veredicto de antipatrones

**¿Parece hecho por IA?** Sí, en cuanto se baja del hero. El primer medio segundo tiene voz (la Bricolage Grotesque del titular, la banda violeta en marquesina, el cierre a sangre con «TRIMMO» en contorno), pero a los cinco segundos cualquier diseñador dice «la landing de producto de IA de 2025»: negro con tres brillos radiales violeta, rejilla técnica de 40 px, tarjetas de cristal con desenfoque, bento, eyebrow en mayúsculas sobre cada sección, degradado en el texto del h1 e icono en cuadradito sobre cada título. Falla el test de reflejo de categoría en los dos niveles: «producto con IA → violeta sobre negro» y «SaaS oscuro que no es crema → estilo Linear/Vercel con cristal y halo». El violeta es identidad comprometida y se respeta; lo que es reflejo es la ejecución, y buena parte de ella contradice las reglas del propio DESIGN.md.

**Evaluación de diseño (elemento por elemento):**
- `.lp-hero__accent` («vendedor»): `background-clip: text` con degradado. Prohibición absoluta y Regla del Titular Sólido. Además la «r» final cae a #8a2be2 y baja a 3,3:1 de contraste.
- `.lp-eyebrow` ×5 (Capacidades · Cómo funciona · Por qué Trimmo · Ediciones · Empieza hoy): el kicker sobre cada sección, literalmente lo que prohíbe la Regla del Overline Confinado.
- 19 elementos con `backdrop-filter: blur(14px) saturate(150%)`: `.lp-card`, `.lp-step`, `.lp-col`, `.lp-edition`, `.lp-mock`, `.lp-mock__float`, `.lp-meter`. Cristal por defecto, contra la Regla del Cristal Estructural; sobre un fondo estático el desenfoque ni se ve: es coste de GPU sin efecto.
- `.lp-card__ic` (40 px, radio 11 px, halo) sobre los 7 títulos de tarjeta y `.lp-step__n` sobre los 3 pasos: «icono redondeado grande sobre cada título, grita plantilla».
- Gramática repetida cuatro veces (eyebrow → h2 → lede → rejilla de tarjetas con borde) y un único reveal uniforme en los 19 bloques.
- Rejilla de 40 px repetida tres veces (`.lp::before`, `.lp-band::before`, `.lp-cta-band::before`); tres brillos radiales más `.lp-hero__glow` con `filter: blur(14px)`.
- Ghost-card: `.lp-mock` (borde 1 px + sombra de 60 px) y `.lp-mock__float` (borde 1 px + sombra de 36 px).
- Cero imágenes (`img`/`picture`/`video`/`canvas` = 0). La única «imagen» es un chat falso en CSS; las tarjetas de Bandeja, Pipeline, Flujos y Difusiones describen con texto un producto que existe.
- Copia de meta-crítica: la columna «WhatsApp a mano» es un hombre de paja, con una fila imposible («Sin idea de cuánto cuesta cada respuesta de IA»: atendiendo a mano no hay IA).
- Lo que no es slop: la pareja Bricolage + Hanken (fuera de la lista de reflejo, eje expresiva/neutra), el bento asimétrico, la banda «drenched» con marquesina, el medidor de tokens (`.lp-meter`, la ilustración más específica de la página), la secuencia numerada real de «Cómo funciona», el espaciado del display en -0,025em, sin rayas laterales, sin sobre-redondeo, reduced-motion respetado y contenido visible sin JS.

**Detector determinista:**
- CLI (`detect.mjs` sobre `apps/web/src/features/marketing`): 27 hallazgos, todos en `landing.css`. 1 aviso real: `gradient-text` en `landing.css:972` (`.lp-hero__accent`). 26 advisories: 16 colores fuera de DESIGN.md (`#000` ×3, negros translúcidos de sombra ×5, `#e6d8ff`, `#7a7290`, `#a858ff`, `#5a0fae`, verdes de `--ok`) y 10 radios fuera de la escala (10 px ×3, 9 px ×2, 11 px ×2, 16 px, 20 px, 2 px).
- Navegador (script inyectado en la página viva): «51 antipatrones» con 75 líneas de detalle. `ai-color-palette` ×33 (degradado violeta ×19, texto violeta neón ×14), `dark-glow` ×17 (halo #8a2be2), `icon-tile-stack` ×7 (los siete iconos sobre h3), `repeated-section-kickers` ×5 (coincide con los 5 `.lp-eyebrow`), `low-contrast` ×4, `clipped-overflow-container` ×3 (`.lp`, `.lp-hero`, `.lp-mock` recortan un hijo posicionado), `text-overflow` ×2 (`.lp-conv__last` desborda 33 y 18 px), `line-length` ×2 (92 y 156 caracteres por línea), `oversized-h1` ×1 (72 px, 33 vh), `nested-cards` ×1.
- Coincidencias entre las dos evaluaciones: degradado de texto, eyebrows, cristal por defecto, iconos sobre títulos, halo neón y el recorte del mock del hero. Lo que el detector cazó y la revisión no: los desbordes de `.lp-conv__last` y las líneas de 92 y 156 caracteres. Falsos positivos del detector: dos `low-contrast` «#ffffff sobre #ffffff» (1,0:1, texto invisible que no existe; resolvió mal un fondo con degradado) y el desborde horizontal de 1.586 px a 1440, causado por los nodos del propio overlay (antes de inyectar era 1440/1440; a 390 es 390/390).

**Overlays:** la ejecución fue en navegador sin cabeza, así que no hay pestaña «[Human]» visible. Los contornos y etiquetas sí se renderizaron en la página (101 nodos) y quedaron capturados en `scratchpad/repro-fb-login/critique-b-1440-injected.png` y `critique-b-1440-injected-full.png`.

## Impresión general

Hay una marca ahí dentro: el titular en Bricolage, la banda violeta que corre y el cierre a sangre con la marca en contorno son decisiones que un competidor no podría describir como suyas. Todo lo que hay entre medias las diluye: siete tarjetas de texto con icono, cristal en todo, brillos y rejilla por todas partes, y un producto real que nunca aparece. La mayor oportunidad es sustituir la explicación por la prueba: enseñar la bandeja, el embudo y el editor de flujos de verdad, y dejar que la banda y el titular carguen solos la identidad.

## Qué funciona

1. **Tipografía con voz.** Bricolage Grotesque 72 px / -0,025em / 1,04 en el h1 («Convierte WhatsApp en tu mejor vendedor.» equilibrado en cuatro líneas) y Hanken Grotesk 17 px/1,6 en cuerpo. Pareja por eje de contraste, fuera de la lista de reflejo, escala fluida correcta (41 px a 390 sin desbordar).
2. **Los momentos «drenched» en violeta.** La banda (marquesina de 40 s, pausa en hover, estática con reduced-motion) y el cierre con «TRIMMO» en contorno y botón blanco invertido (8,75:1). Es el pico de la página.
3. **Higiene técnica real.** Contenido visible sin JS, reduced-motion apaga todo, anillo de foco de 2 px en los CTA, sin desborde horizontal a 390, texto apagado a 7,4:1 sobre tarjeta, un solo h1, header/nav/footer semánticos. El medidor de tokens (31.200 / 50.000 tok · $0,21) es la ilustración más honesta de la página.

## Problemas prioritarios

**[P0] Móvil sin navegación ni login.**
- Qué: en ≤900 px se oculta `.lp-nav__links` pero `.lp-burger` sigue en `display: none` (ninguna media query lo muestra); en ≤560 px desaparece también «Iniciar sesión». A 390 px el header solo tiene «Empezar gratis». El estado `menuOpen` y el menú móvil del JSX son código muerto.
- Por qué importa: el usuario número uno según PRODUCT.md es el vendedor en el celular. El cliente que quiere entrar no puede sin bajar unos 7.600 px, y quien quiere ver «Cómo funciona» no tiene cómo saltar.
- Cómo: mostrar `.lp-burger` en `@media (max-width: 900px)`; mantener «Iniciar sesión» visible a todo ancho (junto a la hamburguesa o dentro del menú); renderizar el menú con portal o `<dialog>`, `aria-controls`, foco atrapado y cierre con Esc; sacar el estilo inline del menú a CSS.
- Comando sugerido: `$impeccable adapt`.

**[P1] Gramática de plantilla que contradice DESIGN.md.**
- Qué: degradado en `.lp-hero__accent`; `.lp-eyebrow` ×5; `backdrop-filter` en 19 elementos, incluidas todas las tarjetas; `.lp-card__ic` sobre cada título; rejilla técnica tres veces; ghost-card en el mock.
- Por qué importa: PRODUCT.md dice «si grita “lo generó una IA”, falló», y son exactamente las reglas que el sistema ya prohíbe. Además 19 desenfoques más tres brillos radiales más un `blur(14px)` de 620 px es scroll a tirones en un Android medio, sin beneficio visual.
- Cómo: `.lp-hero__accent` en un solo color sólido (#b26bff) o énfasis por peso; borrar los cinco eyebrows (el h2 ya lo dice) o dejar uno solo con nombre; quitar `backdrop-filter` de tarjetas, pasos, columnas, ediciones, mock y medidor conservando la línea de luz (dejarlo solo en `.lp-nav`); sustituir `.lp-card__ic` por nada o por un recorte real del producto; rejilla solo en la banda y el cierre, no en `.lp::before`; en el mock, borde o sombra, no los dos.
- Comando sugerido: `$impeccable quieter`, y después `$impeccable typeset` para rehacer la jerarquía sin eyebrows.

**[P1] Nada real que ver, nadie en quien confiar, nada que cueste.**
- Qué: cero imágenes; las tarjetas de Bandeja, Pipeline, Flujos y Difusiones describen con texto un producto que existe (hay capturas reales en el repo); cero prueba social; la edición nube dice «Enterprise · en la nube» y «Empieza gratis, sin tarjeta» sin precio, sin límites, sin FAQ.
- Por qué importa: es la sección de la decisión. Jordan no sabe si le cobrarán y Riley no cree nada sin ver la bandeja real. En registro de marca, cero imágenes es un bug, no una elección.
- Cómo: convertir las tarjetas de producto en recortes reales (`<img>` con `alt` en voz de marca, por ejemplo «La bandeja con tres números conectados y el agente respondiendo») o una tira de producto a todo ancho entre hero y capacidades; una franja de prueba antes de Ediciones (estrellas y commits de GitHub, empresas, dos citas cortas); renombrar la etiqueta a «Nube · gestionado por Trimmo» y decir qué incluye «gratis» (usuarios, números, mensajes); cuatro preguntas de FAQ bajo la nota de ediciones y un enlace «Precios» en el nav.
- Comando sugerido: `$impeccable bolder` (imagen y prueba) y `$impeccable clarify` (copy de plan y precio).

**[P1] Grietas en el mock del hero y anclas que aterrizan bajo el nav.**
- Qué: `.lp-mock { overflow: hidden }` recorta 13 px el badge «Lead calificado» y este tapa el composer y «Enviar»; `.lp-bub__tag` es `inline-flex` seguido de texto («Agente IA¡Hola María!»); a 390 px la columna de 116 px trunca «María R.» y los previews; el mock no lleva `aria-hidden` (el lector de pantalla lee una conversación ficticia) y no hay `<main>`; `#como`, `#porque` y `#ediciones` sin `scroll-margin-top` quedan bajo el nav de 67 px.
- Por qué importa: es la primera impresión del producto y la navegación básica; Riley lo encuentra en treinta segundos.
- Cómo: `overflow: visible` en el mock con el radio en `.lp-mock__body`, o mover el badge fuera del composer; `.lp-bub__tag { display: flex }`; en ≤560 px solo avatares en la lista o columna de 132 px; `aria-hidden="true"` en el mock; envolver las secciones en `<main>`; `.lp-section { scroll-margin-top: 90px }` (o `scroll-padding-top` en `html`) y `aria-current` en el nav con el IntersectionObserver que ya existe.
- Comando sugerido: `$impeccable polish`.

**[P2] Contraste en el cierre violeta y metadatos en inglés.**
- Qué: `.lp-cta-band p` (blanco al 88 % sobre #9a44f2) = 3,99:1 a 17 px (mínimo 4,5) y 3,0:1 sobre el brillo superior; `.lp-btn--outline` = 4,14:1; `.lp-bub__tag` a 10 px = 3,82:1; `.lp-pill` justo en 4,50:1. `<html lang="en">` (DEFAULT_LOCALE «en») con `<title>`, description y OG en inglés sobre una landing solo en español.
- Por qué importa: WCAG AA es objetivo declarado; el lector de pantalla pronuncia el español con voz inglesa; la tarjeta social y el resultado de búsqueda salen en otro idioma.
- Cómo: párrafo del cierre en blanco puro y bajar la parada media del degradado a #8a2be2 (5,96:1); `.lp-btn--outline` con fondo al 16 % y peso 700; `.lp-bub__tag` ≥11 px en blanco; metadatos en español para la ruta de la landing y `lang="es"` cuando se sirve la landing.
- Comando sugerido: `$impeccable harden` (metadatos) y `$impeccable audit` (contraste).

## Personas: banderas rojas

**Jordan (primerizo confundido):** la píldora «Agentes de IA · WhatsApp Business · Open source» parece un botón y no hace nada. Pulsa «Ver cómo funciona» y el título queda bajo el nav: «¿ha pasado algo?». La línea de confianza arranca con «Trae tu propio modelo de IA», que suena a deberes; luego «AGPL», «API key», «Docker Compose», «Copilot o Autopilot» sin definir. En Ediciones, «Enterprise · en la nube» frente a «Gratis, para siempre»: ¿cuál es para mí y qué me cobrarán después? Encuentra «Empezar gratis» pero no sabe qué necesita tener listo antes (¿un número de WhatsApp Business?).

**Riley (probador metódico):** pasa el ratón por una tarjeta, se eleva y brilla, no es enlace. Tabula: foco correcto, pero no puede pausar la marquesina con teclado. Redimensiona a 390: sin menú ni login. Pulsa «Cómo funciona» tres veces: el título siempre bajo el nav. Mock: badge recortado, «Agente IA¡Hola», «Mar…» en móvil, y el badge «Lead calificado» desaparece del todo en ≤560 px. Inspecciona: `lang="en"`, title en inglés, sin `<main>`, chat falso sin `aria-hidden`, footer con seis enlaces de 22 px. Lee «Sin idea de cuánto cuesta cada respuesta de IA» bajo «WhatsApp a mano» y concluye que la comparación está amañada. En el CSS, `.lp-cta` sin usar y `.lp-hero__glow`, `.lp-nav`, `.lp-btn--primary` y `.lp-mock` declarados dos veces.

**Casey (móvil, distraída):** el header solo tiene «Empezar gratis»; quiere entrar, lo pulsa y aterriza en el registro. Hero de 1.100 px antes de ver el mock (la única «prueba») a unos 1.360 px. Página de 8.107 px; solo Capacidades son 2.344 px de siete tarjetas apiladas; no llega a «Cómo funciona». En el cierre, el botón «Iniciar sesión» de contorno se superpone al «TRIMMO» en contorno: ruido alrededor del objetivo táctil. Footer con enlaces de 22 px en dos filas.

## Observaciones menores

- Dos sistemas tipográficos conviven: Bricolage + Hanken en la landing y Space Grotesk + Inter en la app; el paso a `/register` cambia de familia en el momento de compromiso. Hay que decidir uno.
- `--ok: #4ade80` (verde genérico) en vez de los tokens; los checks verdes de las tarjetas violan la Regla del Verde Reservado si no señalan WhatsApp ni estado.
- Radio de tarjeta 14 px frente a los 12 px del sistema; mock a 16 px.
- La tarjeta «Bandeja en tiempo real» tiene tres líneas de texto y unos 90 px de vacío a 1440.
- El círculo vacío de la columna «mala» parece un radio sin marcar; mejor un guion o ningún icono.
- El botón primario no hunde 1 px en `:active` (DESIGN.md lo pide).
- A 1024 px el h1 mide 66,5 px en cuatro líneas junto a un mock de 444 px: el hero queda apretado.
- «Open source» seis veces; «Empezar gratis» cuatro y «Iniciar sesión» tres.
- Falta control de pausa en la banda; con reduced-motion queda cortada a mitad de palabra en los bordes.
- Footer sin Términos ni contacto; solo Privacidad.
- `.lp-conv__last` desborda su caja 33 y 18 px; dos bloques de texto a 92 y 156 caracteres por línea.

## Preguntas para pensar

1. Si quitas el halo, la rejilla, el cristal y los eyebrows, ¿qué queda que solo pueda ser Trimmo? ¿Pueden la banda violeta y la Bricolage cargar solas la identidad y dejar que el resto de la página sea el producto real?
2. ¿Por qué la landing de un CRM que ya existe, con bandeja, embudo y flujos funcionando, enseña un chat falso y siete tarjetas de texto en vez de la bandeja de verdad con un lead entrando y el agente respondiendo?
3. Si el vendedor en el celular es tu usuario número uno, ¿por qué la versión móvil es la que no tiene menú, ni login, ni el «Lead calificado» del hero, y mide 8.100 px?
