"use client";

import { useEffect, useRef, useState } from "react";
import { connectWithTicket } from "./actions";

const APP_ID = process.env.NEXT_PUBLIC_WHATSAPP_APP_ID ?? "";
const CONFIG_ID = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID ?? "";
const GRAPH_VERSION = "v21.0";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

export interface HubTexts {
  title: string;
  subtitle: string;
  loadingSdk: string;
  continueWithMeta: string;
  waiting: string;
  saving: string;
  done: string;
  notCompleted: string;
  missingConfig: string;
  backHint: string;
}

type Estado =
  | { tipo: "cargando" }
  | { tipo: "listo" }
  | { tipo: "esperando" }
  | { tipo: "guardando" }
  | { tipo: "hecho"; url: string }
  | { tipo: "error"; mensaje: string };

/**
 * El único sitio donde carga el SDK de Meta en una instalación SaaS.
 *
 * Esta página vive en el dominio raíz, que es el que está listado en la app
 * de Meta. El pase que llega en la URL dice quién es y de qué empresa; aquí no
 * hay sesión ni hace falta: al terminar, el pase y el resultado de Meta viajan
 * a la API, que abre el contexto de esa empresa y guarda el número.
 *
 * Lo normal es verla **dentro de un modal del panel de la empresa** (`embed`):
 * un iframe servido desde el dominio raíz. Meta mira el dominio del marco que
 * llama a `FB.login`, no el de la página de fuera, así que el usuario no sale
 * de `acme.trimmo.lat` y aun así el SDK arranca en `trimmo.lat`.
 */
export function ConnectWhatsappHub({
  ticket,
  embed = false,
  t,
}: {
  ticket: string;
  /** Va dentro de un iframe del panel: sin marco propio y sin salir de aquí al acabar. */
  embed?: boolean;
  t: HubTexts;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const signupRef = useRef<{ phoneNumberId?: string; wabaId?: string }>({});

  // Cargar el SDK.
  useEffect(() => {
    if (!APP_ID || !CONFIG_ID) return;
    window.fbAsyncInit = () => {
      window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: true, version: GRAPH_VERSION });
      setEstado({ tipo: "listo" });
    };
    if (document.getElementById("fb-sdk")) {
      if (window.FB) setEstado({ tipo: "listo" });
      return;
    }
    const s = document.createElement("script");
    s.id = "fb-sdk";
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.src = "https://connect.facebook.net/es_LA/sdk.js";
    // Un bloqueador de contenido o una CSP pueden impedir la carga: que se vea.
    s.onerror = () =>
      setEstado({ tipo: "error", mensaje: "No se pudo cargar el SDK de Meta (¿bloqueador de contenido?)." });
    document.body.appendChild(s);
    const aviso = setTimeout(() => {
      setEstado((e) =>
        e.tipo === "cargando"
          ? { tipo: "error", mensaje: "El SDK de Meta tarda demasiado en cargar. Desactiva el bloqueador de contenido y recarga." }
          : e,
      );
    }, 12_000);
    return () => clearTimeout(aviso);
  }, []);

  // El Embedded Signup manda por postMessage el waba_id / phone_number_id.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!String(event.origin).includes("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.data) {
          signupRef.current = {
            phoneNumberId: data.data.phone_number_id,
            wabaId: data.data.waba_id,
          };
        }
      } catch {
        /* mensajes ajenos */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Al terminar se avisa a quien nos alberga, que refresca su lista sin
  // recargar: el panel que nos tiene en un iframe (cierra él el modal) o, si
  // se abrió como ventana aparte, la que nos abrió (nos cerramos). Si se llegó
  // aquí como página suelta, se vuelve al panel. Un momento para que se lea el
  // "listo".
  useEffect(() => {
    if (estado.tipo !== "hecho") return;
    const url = estado.url;
    const id = setTimeout(() => {
      // Solo al origen del panel de esa empresa, que es quien nos alberga.
      const origen = new URL(url).origin;
      if (window.parent !== window) {
        window.parent.postMessage({ type: "trimmo:whatsapp-connected" }, origen);
        return;
      }
      const abridor = window.opener as Window | null;
      if (abridor && !abridor.closed) {
        abridor.postMessage({ type: "trimmo:whatsapp-connected" }, origen);
        window.close();
        // Si el navegador no deja cerrar, se navega igual al panel.
        setTimeout(() => window.location.assign(url), 300);
        return;
      }
      window.location.assign(url);
    }, 900);
    return () => clearTimeout(id);
  }, [estado]);

  // Lo que sigue a la respuesta de Meta. Va aparte porque el SDK exige que el
  // callback de FB.login sea una función normal: comprueba su tipo y rechaza
  // un AsyncFunction con "Expression is of type asyncfunction, not function".
  async function procesar(response: any) {
    const code = response?.authResponse?.code;
    const { phoneNumberId, wabaId } = signupRef.current;
    if (!code || !phoneNumberId) {
      setEstado({
        tipo: "error",
        mensaje: `${t.notCompleted} (${response?.status ?? "sin respuesta"}${phoneNumberId ? "" : ", sin número"})`,
      });
      return;
    }
    setEstado({ tipo: "guardando" });
    const r = await connectWithTicket({ ticket, code, phoneNumberId, wabaId });
    if (r.ok) setEstado({ tipo: "hecho", url: r.returnUrl });
    else setEstado({ tipo: "error", mensaje: r.error });
  }

  function lanzar() {
    if (!window.FB) {
      setEstado({ tipo: "error", mensaje: "El SDK de Meta no está disponible. Recarga la página." });
      return;
    }
    setEstado({ tipo: "esperando" });
    // Si en unos segundos no hay ventana ni respuesta, casi siempre es el
    // bloqueador de ventanas emergentes del navegador.
    const vigilante = setTimeout(() => {
      setEstado((e) =>
        e.tipo === "esperando"
          ? { tipo: "error", mensaje: "No se abrió la ventana de Meta. Permite las ventanas emergentes para trimmo.lat y vuelve a intentarlo." }
          : e,
      );
    }, 8_000);
    try {
      window.FB.login(
        // Función normal a propósito: ver `procesar`.
        (response: any) => {
          clearTimeout(vigilante);
          console.info("[conector] respuesta de Meta:", response);
          void procesar(response);
        },
        {
          config_id: CONFIG_ID,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3",
          },
        },
      );
    } catch (e) {
      clearTimeout(vigilante);
      console.error("[conector] FB.login lanzó:", e);
      setEstado({ tipo: "error", mensaje: `Meta devolvió un error al abrir la ventana: ${(e as Error).message}` });
    }
  }

  if (!APP_ID || !CONFIG_ID) {
    return (
      <div style={caja}>
        <h1 style={titulo}>{t.title}</h1>
        <p style={texto}>{t.missingConfig}</p>
      </div>
    );
  }

  const ocupado = estado.tipo === "esperando" || estado.tipo === "guardando" || estado.tipo === "hecho";

  return (
    <div style={embed ? cajaEmbebida : caja}>
      <h1 style={titulo}>{t.title}</h1>
      <p style={texto}>{t.subtitle}</p>

      {estado.tipo === "error" && (
        <p role="alert" style={{ ...texto, color: "#e08a8a" }}>{estado.mensaje}</p>
      )}

      <button
        onClick={lanzar}
        disabled={estado.tipo === "cargando" || ocupado}
        style={{ ...boton, opacity: estado.tipo === "cargando" || ocupado ? 0.6 : 1 }}
      >
        {estado.tipo === "cargando"
          ? t.loadingSdk
          : estado.tipo === "esperando"
            ? t.waiting
            : estado.tipo === "guardando"
              ? t.saving
              : estado.tipo === "hecho"
                ? t.done
                : t.continueWithMeta}
      </button>

      {!embed && <p style={{ ...texto, fontSize: 12, marginTop: 18 }}>{t.backHint}</p>}
    </div>
  );
}

const caja: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  padding: 28,
  borderRadius: 12,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow-card)",
};
// Dentro del modal el marco lo pone el panel.
const cajaEmbebida: React.CSSProperties = { width: "100%", padding: "4px 2px" };
const titulo: React.CSSProperties = { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" };
const texto: React.CSSProperties = { color: "var(--muted)", fontSize: 14, lineHeight: 1.5, margin: "8px 0 0" };
const boton: React.CSSProperties = {
  width: "100%",
  marginTop: 22,
  padding: "12px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  fontWeight: 600,
  font: "inherit",
  cursor: "pointer",
};
