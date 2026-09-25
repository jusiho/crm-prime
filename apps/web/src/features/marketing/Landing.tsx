"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./landing.css";

const GITHUB = "https://github.com/jusiho/crm-prime";

export function Landing() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Reveals + estado del nav. El contenido es visible por defecto (sin JS);
  // la clase lp-js solo añade la animación cuando hay hidratación.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.add("lp-js");

    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    root.querySelectorAll(".lp-reveal").forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  return (
    <div className="lp" ref={rootRef}>
      <header className="lp-nav" data-scrolled={scrolled}>
        <div className="lp-wrap lp-nav__inner">
          <span className="lp-brand">
            <span className="lp-brand__mark"><Logo /></span>
            Trimmo
          </span>
          <nav className="lp-nav__links">
            <a href="#capacidades">Producto</a>
            <a href="#como">Cómo funciona</a>
            <a href="#porque">Por qué</a>
            <a href="#ediciones">Open source</a>
            <Link href="/docs">Docs</Link>
          </nav>
          <div className="lp-nav__cta">
            <Link href="/login" className="lp-nav__login">Iniciar sesión</Link>
            <Link href="/register" className="lp-btn lp-btn--primary">
              Empezar gratis
            </Link>
          </div>
          <button
            className="lp-burger"
            aria-label="Menú"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Burger />
          </button>
        </div>
        {menuOpen && (
          <div className="lp-wrap" style={{ paddingBottom: 16 }}>
            <div style={mobileMenu}>
              <a href="#capacidades" onClick={() => setMenuOpen(false)}>Producto</a>
              <a href="#como" onClick={() => setMenuOpen(false)}>Cómo funciona</a>
              <a href="#porque" onClick={() => setMenuOpen(false)}>Por qué</a>
              <a href="#ediciones" onClick={() => setMenuOpen(false)}>Open source</a>
              <Link href="/docs">Docs</Link>
              <Link href="/login">Iniciar sesión</Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-hero__glow" />
        <div className="lp-wrap lp-hero__grid">
          <div>
            <span className="lp-pill lp-anim" style={{ animationDelay: "0.02s" }}>
              <span className="lp-pill__dot" /> Agentes de IA · WhatsApp Business · Open source
            </span>
            <h1 className="lp-anim" style={{ animationDelay: "0.08s" }}>
              Convierte WhatsApp en tu mejor{" "}
              <span className="lp-hero__accent">vendedor</span>.
            </h1>
            <p className="lp-hero__sub lp-anim" style={{ animationDelay: "0.16s" }}>
              El CRM con agentes de IA que responde, califica y agenda a tus
              leads en segundos — 24/7, directo en tu número de WhatsApp.
            </p>
            <div className="lp-hero__cta lp-anim" style={{ animationDelay: "0.24s" }}>
              <Link href="/register" className="lp-btn lp-btn--primary lp-btn--lg">
                Empezar gratis <Arrow />
              </Link>
              <a href="#como" className="lp-btn lp-btn--ghost lp-btn--lg">
                Ver cómo funciona
              </a>
            </div>
            <div className="lp-hero__trust lp-anim" style={{ animationDelay: "0.32s" }}>
              <Check />
              <span>
                Sin tarjeta · <b>Trae tu propio modelo de IA</b> · Código abierto (AGPL)
              </span>
            </div>
          </div>

          <div className="lp-anim" style={{ animationDelay: "0.2s" }}>
            <ProductMock />
          </div>
        </div>
      </section>

      {/* ── Tira de valor ── */}
      <div className="lp-strip">
        <div className="lp-wrap lp-strip__inner">
          <span><b>Tiempo real</b></span>
          <span><b>Multi-número</b></span>
          <span><b>Tu propio modelo de IA</b></span>
          <span><b>Gasto bajo control</b></span>
          <span><b>Open source</b></span>
        </div>
      </div>

      {/* ── Capacidades ── */}
      <section className="lp-section" id="capacidades">
        <div className="lp-wrap">
          <div className="lp-head lp-reveal">
            <h2>Toda tu operación de ventas, en una sola pantalla.</h2>
            <p className="lp-lede">
              Deja de saltar entre el celular, hojas de cálculo y notas sueltas.
              Trimmo junta tus conversaciones, tu embudo y tu IA en un mismo
              lugar.
            </p>
          </div>

          <div className="lp-bento">
            <article className="lp-card lp-card--wide lp-card--feature lp-reveal">
              <span className="lp-card__ic"><IconBolt /></span>
              <h3>Un agente de IA que atiende por ti</h3>
              <p>
                Responde al instante, entiende la intención del cliente, lo
                califica y agenda — y cuando el caso lo amerita, lo escala a una
                persona de tu equipo. Responde con <b>tu</b> información gracias a
                la base de conocimiento.
              </p>
              <div className="lp-mini">
                <span className="lp-chip">Responde 24/7</span>
                <span className="lp-chip">Califica leads</span>
                <span className="lp-chip">Escala a humano</span>
                <span className="lp-chip">Copilot o Autopilot</span>
              </div>
            </article>

            <article className="lp-card lp-card--tall lp-reveal">
              <span className="lp-card__ic"><IconInbox /></span>
              <h3>Bandeja en tiempo real</h3>
              <p>
                Todas tus conversaciones y todos tus números de WhatsApp en una
                bandeja viva, con dueño claro y filtros de pendientes.
              </p>
            </article>

            <article className="lp-card lp-card--third lp-reveal">
              <span className="lp-card__ic"><IconPipeline /></span>
              <h3>Pipeline de ventas</h3>
              <p>Arrastra cada lead por tu embudo y nunca pierdas el seguimiento.</p>
            </article>

            <article className="lp-card lp-card--third lp-reveal">
              <span className="lp-card__ic"><IconMega /></span>
              <h3>Difusiones y plantillas</h3>
              <p>Envía difusiones con plantillas aprobadas por Meta a tu audiencia.</p>
            </article>

            <article className="lp-card lp-card--third lp-reveal">
              <span className="lp-card__ic"><IconFlow /></span>
              <h3>Flujos sin código</h3>
              <p>Automatiza la conversación con un constructor visual de arrastrar.</p>
            </article>

            <article className="lp-card lp-card--half lp-reveal">
              <span className="lp-card__ic"><IconModel /></span>
              <h3>Trae tu propio modelo</h3>
              <p>
                OpenAI, Claude o cualquier API compatible con OpenAI, con{" "}
                <b>tu</b> API key. Y el modelo se elige <b>por agente</b>: uno
                rápido y barato para las preguntas de siempre, uno potente para
                la venta que lo merece.
              </p>
              <div className="lp-mini">
                <span className="lp-chip">OpenAI</span>
                <span className="lp-chip">Claude</span>
                <span className="lp-chip">API compatible</span>
                <span className="lp-chip">Modelo por agente</span>
              </div>
            </article>

            <article className="lp-card lp-card--half lp-reveal">
              <span className="lp-card__ic"><IconGauge /></span>
              <h3>Sabes cuánto gasta cada agente</h3>
              <p>
                Cada respuesta registra sus tokens y su coste en dólares. Ves el
                gasto del mes por agente y le pones un <b>tope</b>: al llegar,
                la IA se detiene y la conversación pasa a tu equipo. Sin
                sorpresas en la factura.
              </p>
              <div className="lp-meter" aria-hidden="true">
                <div className="lp-meter__head">
                  <span>Agente Ventas · este mes</span>
                  <b>31.200 / 50.000 tok · $0,21</b>
                </div>
                <div className="lp-meter__bar"><span style={{ width: "62%" }} /></div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="lp-section" id="como" style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <div className="lp-head lp-reveal">
            <h2>De WhatsApp a venta en tres pasos.</h2>
            <p className="lp-lede">
              Sin migraciones eternas ni semanas de implementación. Conectas y
              empiezas.
            </p>
          </div>
          <div className="lp-steps">
            <div className="lp-step lp-reveal">
              <div className="lp-step__n">1</div>
              <h3>Conecta tu WhatsApp</h3>
              <p>Enlaza tu número de WhatsApp Business en minutos, sin tocar código.</p>
            </div>
            <div className="lp-step lp-reveal">
              <div className="lp-step__n">2</div>
              <h3>Entrena tu agente</h3>
              <p>Dale tu información, tu tono y tus reglas. Define cuándo responde solo y cuándo pasa a un humano.</p>
            </div>
            <div className="lp-step lp-reveal">
              <div className="lp-step__n">3</div>
              <h3>Empieza a vender</h3>
              <p>El agente atiende y califica cada lead; tu equipo solo entra a cerrar.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Por qué cambiarse ── */}
      <section className="lp-section" id="porque" style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <div className="lp-head lp-reveal">
            <h2>La diferencia entre responder tarde y cerrar la venta.</h2>
          </div>
          <div className="lp-compare lp-reveal">
            <div className="lp-col lp-col--bad">
              <div className="lp-col__label">WhatsApp a mano</div>
              {[
                "Leads que esperan horas por respuesta",
                "Mensajes que se pierden entre vendedores",
                "Responder uno por uno, todo el día",
                "Sin saber en qué quedó cada conversación",
                "Sin idea de cuánto cuesta cada respuesta de IA",
              ].map((t) => (
                <div className="lp-row" key={t}>
                  <span className="lp-row__ic"><Dot /></span>
                  {t}
                </div>
              ))}
            </div>
            <div className="lp-col lp-col--good">
              <div className="lp-col__label">Con Trimmo</div>
              {[
                "Respuesta en segundos, las 24 horas",
                "Todo en una bandeja, con dueño claro",
                "La IA responde y califica por ti",
                "Cada lead con su historial, etapa y notas",
                "Gasto de IA por agente, con tope mensual",
              ].map((t) => (
                <div className="lp-row" key={t}>
                  <span className="lp-row__ic"><Check /></span>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Ediciones: open source / nube ── */}
      <section className="lp-section" id="ediciones" style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <div className="lp-head lp-reveal">
            <h2>Dos formas de tener Trimmo.</h2>
            <p className="lp-lede">
              El mismo CRM, con el mismo código abierto en el núcleo. Elige si lo
              instalas tú o si lo alojamos nosotros.
            </p>
          </div>
          <div className="lp-editions">
            <article className="lp-edition lp-reveal">
              <div className="lp-edition__tag">Open source · AGPL-3.0</div>
              <h3>Instálalo en tu servidor</h3>
              <p className="lp-edition__price">Gratis, para siempre</p>
              <p>
                El CRM completo, para una empresa, con tus datos en tu base y
                tus propias claves. Lo levantas con Docker en tu servidor y no
                dependes de nadie.
              </p>
              <div className="lp-edition__rows">
                {[
                  "Código abierto en GitHub",
                  "Una empresa, usuarios y números sin límite",
                  "Docker Compose: base de datos, API y web",
                  "Tu app de Meta y tus API keys de IA",
                  "Bandeja, agentes, flujos, difusiones: todo incluido",
                ].map((t) => (
                  <div className="lp-row" key={t}>
                    <span className="lp-row__ic"><Check /></span>
                    {t}
                  </div>
                ))}
              </div>
              <div className="lp-edition__cta">
                <a
                  href={GITHUB}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-btn lp-btn--ghost"
                >
                  <IconGit /> Ver en GitHub
                </a>
              </div>
            </article>

            <article className="lp-edition lp-edition--cloud lp-reveal">
              <div className="lp-edition__tag">Enterprise · en la nube</div>
              <h3>Nosotros lo alojamos</h3>
              <p className="lp-edition__price">Empieza gratis, sin tarjeta</p>
              <p>
                Tu espacio en <b>tu-empresa.trimmo.lat</b> en dos minutos. Sin
                servidores ni actualizaciones que hacer, y con tus datos
                aislados de los de cualquier otra empresa.
              </p>
              <div className="lp-edition__rows">
                {[
                  "Alta inmediata con tu propio subdominio",
                  "Conecta WhatsApp desde el panel, en un clic",
                  "Actualizaciones y copias de seguridad incluidas",
                  "Aislamiento por empresa, también en la base de datos",
                  "Soporte de personas que conocen el producto",
                ].map((t) => (
                  <div className="lp-row" key={t}>
                    <span className="lp-row__ic"><Check /></span>
                    {t}
                  </div>
                ))}
              </div>
              <div className="lp-edition__cta">
                <Link href="/register" className="lp-btn lp-btn--primary">
                  Empezar gratis <Arrow />
                </Link>
              </div>
            </article>
          </div>
          <p className="lp-editions__note lp-reveal">
            ¿Empiezas con la versión open source y luego quieres la nube, o al
            revés? Es el mismo esquema de datos: se migra, no se rehace.
          </p>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <div className="lp-cta lp-reveal">
            <h2>Pon a tu agente a vender hoy.</h2>
            <p>
              Conecta tu número, entrena tu IA y deja de perder leads en
              WhatsApp. Empieza gratis, sin tarjeta.
            </p>
            <div className="lp-cta__row">
              <Link href="/register" className="lp-btn lp-btn--primary lp-btn--lg">
                Empezar gratis <Arrow />
              </Link>
              <Link href="/login" className="lp-btn lp-btn--ghost lp-btn--lg">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot__inner">
          <span className="lp-brand" style={{ fontSize: 16 }}>
            <span className="lp-brand__mark" style={{ width: 26, height: 26 }}>
              <Logo />
            </span>
            Trimmo
          </span>
          <nav className="lp-foot__links">
            <a href="#capacidades">Producto</a>
            <a href="#como">Cómo funciona</a>
            <Link href="/docs">Documentación</Link>
            <a href={GITHUB} target="_blank" rel="noopener noreferrer">GitHub</a>
            <Link href="/login">Iniciar sesión</Link>
            <Link href="/privacy">Privacidad</Link>
          </nav>
          <span>© 2026 Trimmo</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Mockup del producto (imagen del hero, no foto de stock) ── */
function ProductMock() {
  return (
    <div className="lp-mock">
      <div className="lp-mock__bar">
        <span className="lp-mock__dot" />
        <span className="lp-mock__dot" />
        <span className="lp-mock__dot" />
        <span className="lp-mock__title">Bandeja · WhatsApp</span>
      </div>
      <div className="lp-mock__body">
        <div className="lp-mock__list">
          <div className="lp-conv lp-conv--active">
            <span className="lp-conv__av">MR</span>
            <div style={{ minWidth: 0 }}>
              <div className="lp-conv__name">María R.</div>
              <div className="lp-conv__last">¿Tienen disponible…?</div>
            </div>
            <span className="lp-conv__pip" />
          </div>
          <div className="lp-conv">
            <span className="lp-conv__av">JL</span>
            <div style={{ minWidth: 0 }}>
              <div className="lp-conv__name">Jorge L.</div>
              <div className="lp-conv__last">Perfecto, gracias 🙌</div>
            </div>
          </div>
          <div className="lp-conv">
            <span className="lp-conv__av">AC</span>
            <div style={{ minWidth: 0 }}>
              <div className="lp-conv__name">Ana C.</div>
              <div className="lp-conv__last">Quiero agendar una…</div>
            </div>
          </div>
        </div>
        <div className="lp-mock__chat">
          <div className="lp-bub lp-bub--in">
            Hola, ¿tienen disponible el plan para 5 vendedores? ¿Cuánto cuesta?
          </div>
          <div className="lp-bub lp-bub--out">
            <span className="lp-bub__tag"><Spark /> Agente IA</span>
            ¡Hola María! Sí 🙌 El plan para equipos cubre hasta 8 usuarios. ¿Te
            agendo una demo de 15 min mañana a las 10:00?
          </div>
          <div className="lp-bub lp-bub--in">Sí, me viene bien 👍</div>
          <div className="lp-mock__composer">
            Escribe un mensaje…
            <span className="lp-mock__send">Enviar</span>
          </div>
        </div>
      </div>
      <div className="lp-mock__float">
        <span className="lp-ic"><Check /></span>
        Lead calificado · demo agendada
      </div>
    </div>
  );
}

const mobileMenu: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: 12,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--surface)",
};

/* ── Iconografía (línea coherente, stroke 1.75) ── */
const S = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Logo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5a8 8 0 1 1 3.2 6.4L4 19l1.1-3.2A7.9 7.9 0 0 1 4 11.5Z" />
      <path d="M9 10.5c.4 2.2 2.3 4.1 4.5 4.5" />
    </svg>
  );
}
function Burger() {
  return (
    <svg {...S} width="20" height="20"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
  );
}
function Arrow() {
  return (
    <svg {...S} width="17" height="17"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  );
}
function Check() {
  return (
    <svg {...S} width="16" height="16"><path d="M20 6 9 17l-5-5" /></svg>
  );
}
function Dot() {
  return (
    <svg {...S} width="16" height="16"><circle cx="12" cy="12" r="8" /></svg>
  );
}
function Spark() {
  return (
    <svg {...S} width="13" height="13"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
  );
}
function IconBolt() {
  return (
    <svg {...S} width="22" height="22"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>
  );
}
function IconInbox() {
  return (
    <svg {...S} width="22" height="22"><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2-7Z" /></svg>
  );
}
function IconPipeline() {
  return (
    <svg {...S} width="22" height="22"><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></svg>
  );
}
function IconMega() {
  return (
    <svg {...S} width="22" height="22"><path d="M4 10v4a1 1 0 0 0 1 1h3l8 5V4L8 9H5a1 1 0 0 0-1 1Z" /><path d="M19 9a3 3 0 0 1 0 6" /></svg>
  );
}
function IconFlow() {
  return (
    <svg {...S} width="22" height="22"><rect x="3" y="3" width="6" height="5" rx="1.5" /><rect x="15" y="16" width="6" height="5" rx="1.5" /><path d="M6 8v5a3 3 0 0 0 3 3h6" /></svg>
  );
}
function IconModel() {
  return (
    <svg {...S} width="22" height="22"><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" /></svg>
  );
}
function IconGauge() {
  return (
    <svg {...S} width="22" height="22"><path d="M4 15a8 8 0 1 1 16 0" /><path d="M12 15l4-5" /><circle cx="12" cy="15" r="1.5" /></svg>
  );
}
function IconGit() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" /></svg>
  );
}
