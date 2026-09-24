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
 */
export function ConnectWhatsappHub({ ticket, t }: { ticket: string; t: HubTexts }) {
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
    document.body.appendChild(s);
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

  // Al terminar, a su panel. Un momento para que se lea el "listo".
  useEffect(() => {
    if (estado.tipo !== "hecho") return;
    const id = setTimeout(() => window.location.assign(estado.url), 900);
    return () => clearTimeout(id);
  }, [estado]);

  function lanzar() {
    if (!window.FB) return;
    setEstado({ tipo: "esperando" });
    window.FB.login(
      async (response: any) => {
        const code = response?.authResponse?.code;
        const { phoneNumberId, wabaId } = signupRef.current;
        if (!code || !phoneNumberId) {
          setEstado({ tipo: "error", mensaje: t.notCompleted });
          return;
        }
        setEstado({ tipo: "guardando" });
        const r = await connectWithTicket({ ticket, code, phoneNumberId, wabaId });
        if (r.ok) setEstado({ tipo: "hecho", url: r.returnUrl });
        else setEstado({ tipo: "error", mensaje: r.error });
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
    <div style={caja}>
      <h1 style={titulo}>{t.title}</h1>
      <p style={texto}>{t.subtitle}</p>

      {estado.tipo === "error" && (
        <p role="alert" style={{ ...texto, color: "#e08a8a" }}>{estado.mensaje}</p>
      )}

      <button
        onClick={lanzar}
        disabled={estado.tipo === "cargando" || ocupado}
        style={boton}
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

      <p style={{ ...texto, fontSize: 12, marginTop: 18 }}>{t.backHint}</p>
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
