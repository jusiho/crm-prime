---
target: landing pública (apps/web/src/features/marketing), segunda pasada
total_score: 28
p0_count: 1
p1_count: 2
timestamp: 2026-09-26T19-02-16Z
slug: apps-web-src-features-marketing-landing-tsx
---
# Crítica de diseño (segunda pasada): landing pública de Trimmo

Objetivo: `apps/web/src/features/marketing/Landing.tsx` + `landing.css` (registro de marca), tras aplicar adapt, quieter, bolder, clarify, typeset, harden, audit y polish. Dos evaluaciones independientes (revisión de diseño con inspección a 1440, 1024 y 390 px; detector en CLI y en navegador), sintetizadas.

## Design Health Score

| # | Heurística | Puntuación | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Nav con sección activa, pausa de banda con `aria-pressed`. Los CTA llevan a un `/register` sin marca ni continuidad. |
| 2 | Correspondencia con el mundo real | 2 | Jerga de desarrollador a la vista: «tok», «AGPL-3.0», «Docker Compose: base de datos, API y web», «API compatible con OpenAI». |
| 3 | Control y libertad | 3 | Esc cierra el menú y devuelve el foco; pausa de marquesina; skip link. La marca no enlaza a la raíz. |
| 4 | Consistencia | 3 | Foco de `summary` con anillo del navegador en vez del violeta; tres tratamientos de «etiqueta». |
| 5 | Prevención de errores | 3 | «Sin tarjeta» y «lo sabrás antes de cobrarte nada». La limitación de Coexistencia solo aparece en la FAQ. |
| 6 | Reconocimiento | 3 | Rótulos del nav distintos de los h2; el estado activo compensa. |
| 7 | Flexibilidad | 3 | Teclado completo, anclas bajo el nav pegajoso (h2 aterriza 19 px por debajo). |
| 8 | Estética minimalista | 2 | 14 tarjetas del mismo material, 8 chips redundantes, dos huecos de 230 px, wordmark decorativo, dos márgenes anulados. |
| 9 | Recuperación de errores | 3 | Sin JS todo visible. Sin `og:image` para compartir por WhatsApp. |
| 10 | Ayuda | 3 | Docs, FAQ y contacto; la FAQ está a 4.100 px sin señal desde el hero. |
| **Total** | | **28/40** | **Bueno: base sólida, atacar las áreas flojas** |

## Veredicto de antipatrones

**Pasa el test de prohibiciones; no pasa del todo la prueba inversa.** Ya no grita «lo hizo una IA»; susurra «landing de SaaS oscuro con violeta». La materia es propia (capturas reales, banda, tipografía, copy honesto); lo que sigue siendo de plantilla es la gramática de secciones.

**Revisión de diseño**, medida: 0 eyebrows; numeración solo en la secuencia real de tres pasos; 0 texto con degradado; 0 rayas laterales; 0 radios ≥24 px; `backdrop-filter` solo en el nav (2 con el menú abierto); tarjetas con borde y línea de luz, sin sombra ancha; sin plantilla de «big number»; h1 Bricolage 64/61/38 px con tracking -0,025em; cuerpo Hanken 17/1,6; 5 imágenes con alt (266 KB en total); sin desborde a 390; reduced-motion apaga marquesina y reveals; contraste compuesto ≥5,7:1 en todo lo muestreado. Tells que quedan: hero modal de categoría (kicker + palabra en acento + dos pastillas + captura), 14 tarjetas del mismo material, wordmark en contorno al pie, 8 chips que repiten los párrafos, dos huecos grandes en el bento.

**Detector determinista.** CLI: 11 hallazgos, todos advisories (8 colores y 3 radios fuera de DESIGN.md), 0 avisos (antes 27 con 1 aviso). Navegador: 19 antipatrones (antes 51): 19 líneas de «paleta violeta» y 3 halos (la propia identidad, elegida a propósito), 3 «contraste bajo» que son falsos positivos (el detector toma como opaco el primer stop blanco al 14 % del degradado del cierre, y el fondo violeta al 16 % de la etiqueta del plan; medidos sobre el fondo real: 7,0:1, 5,9:1 y 10,2:1). Overlays renderizados en la página (19 nodos); ejecución sin cabeza, sin pestaña visible.

## Impresión general

La página ya es de Trimmo: el producto real hace el trabajo de convencer y el violeta aparece donde toca. La mayor oportunidad ahora es de composición, no de estilo: menos cajas iguales, rellenar o rediseñar los dos huecos del bento y llevar la voz hasta el formulario de registro, que hoy es el sitio más frío del recorrido.

## Qué funciona

1. **Producto real como imagen.** Cinco capturas del CRM con contenido en español y alt descriptivo; el medidor de gasto con cifras concretas.
2. **Accesibilidad verificada.** Skip link, anillo de foco violeta en 19 de 19 elementos, Esc con retorno de foco, `aria-pressed`, reduced-motion, contraste ≥5,7:1, sin desborde, anclas bajo el nav.
3. **Copy con voz y honestidad.** «De tú a tú», FAQ que no vende humo sobre Coexistencia, «se migra, no se rehace».

## Problemas prioritarios

- **[P0] Dos márgenes anulados por especificidad.** `.lp p { margin: 0 }` (0,1,1) pisa a `.lp-hero__sub` y a `.lp-plans__note` (0,1,0): el subtítulo va pegado al h1 y la nota de planes queda a la izquierda, sin aire. Arreglo: `.lp :where(p)` o subir la especificidad. Comando: `$impeccable polish`.
- **[P1] Huecos en el bento.** La tarjeta del agente tiene unos 230 px vacíos (la captura de 528 px manda la altura) y «Difusiones y plantillas» 233 px vacíos bajo tres líneas. Arreglo: limitar la captura y reagrupar la rejilla para que las tarjetas de texto compartan fila. Comando: `$impeccable layout`.
- **[P1] El registro rompe la voz.** `/register` sin marca, sin enlace a la raíz, título en inglés, sin «Sin tarjeta». Es el final real de los cuatro CTA. Comando: `$impeccable onboard`.
- **[P2] Menú móvil sin trampa de foco.** Tab sale del diálogo al contenido bloqueado. Arreglo: `inert` en la página mientras el menú está abierto. Comando: `$impeccable harden`.
- **[P2] En móvil la acción principal desaparece de la barra.** Solo queda «Iniciar sesión» durante 8.500 px. Arreglo: barra con «Empezar gratis» compacto y el login dentro del menú. Comando: `$impeccable adapt`.
- **[P3] Gramática de plantilla.** 14 tarjetas iguales, pasos en cajas, antes/después en cajas, wordmark en contorno, chips redundantes. Comando: `$impeccable shape` y `$impeccable distill`.

## Personas: banderas rojas

- **Jordan:** tropieza con «tok», «AGPL-3.0» y «Docker Compose»; se queda con la duda de cuánto costará después; aterriza en un formulario sin marca ni «sin tarjeta».
- **Riley:** Tab escapa del menú móvil; `.lp-band` es un `div` con `aria-label` sin rol; foco de `summary` distinto; el logo no es enlace; sin `og:image`; la captura del hero a escala 0,26 es ilegible salvo las burbujas.
- **Casey:** CTA visible sin scroll (bien), pero después 8.500 px con «Iniciar sesión» como única acción persistente; la tarjeta del agente ocupa unos 1.500 px en móvil.

## Observaciones menores

Columna del hero de 466 px a 1440 (h1 en cuatro líneas); «vendedor» en acento sigue siendo el reflejo de categoría; h2 uniformes y ritmo vertical igual en todas las secciones; `.lp-lede` 19,2 px frente a `.lp-hero__sub` 20 px; «Docs» en el nav principal saca al visitante; sombra de la captura casi invisible sobre negro; sin `og:image`.

## Preguntas para pensar

1. Si la banda y el medidor de gasto son lo más Trimmo de la página, ¿por qué el cierre se apoya en un wordmark en contorno?
2. ¿Y si «Cómo funciona» fuera una sola conversación real de arriba abajo en lugar de tres cajas con número?
3. Cuatro CTA prometen «gratis, sin tarjeta, dos minutos» y el formulario no repite ninguna: ¿cuándo cree el visitante que la promesa se cumple?
