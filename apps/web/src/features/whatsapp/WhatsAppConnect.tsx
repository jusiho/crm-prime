"use client";

import { NavIcon } from "@/components/NavIcons";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WhatsappChannel } from "@crm/shared";
import {
  connectWhatsapp,
  disconnectWhatsapp,
  fetchWhatsappChannels,
  requestWhatsappConnectTicket,
  testWhatsappChannel,
} from "@/lib/bff";

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

/**
 * `hub`: instalación SaaS. El SDK de Meta NO carga aquí (Meta solo lo permite
 * en dominios listados a mano, y este es el subdominio de una empresa): el
 * botón pide un pase y enseña el conector del dominio raíz en un modal, dentro
 * de un iframe. Meta mira el dominio del marco que llama a `FB.login`, no el
 * de la página de fuera: el usuario no sale de su subdominio y aun así el SDK
 * arranca en el dominio listado.
 */
export function WhatsAppConnect({ hub = false }: { hub?: boolean }) {
  const queryClient = useQueryClient();
  const [sdkReady, setSdkReady] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubPending, setHubPending] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  // URL del conector en el modal (iframe) y su origen: solo se aceptan sus avisos.
  const [hubUrl, setHubUrl] = useState<string | null>(null);
  const hubOriginRef = useRef<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  // Canal cuyo token se va a renovar: precarga el formulario manual.
  const [editing, setEditing] = useState<WhatsappChannel | null>(null);
  const manualRef = useRef<HTMLDivElement | null>(null);
  const signupRef = useRef<{ phoneNumberId?: string; wabaId?: string }>({});

  const { data: channels, isPending } = useQuery({
    queryKey: ["wa-channels"],
    queryFn: fetchWhatsappChannels,
  });

  const connect = useMutation({
    mutationFn: connectWhatsapp,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-channels"] }),
  });
  const disconnect = useMutation({
    mutationFn: disconnectWhatsapp,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-channels"] }),
  });

  // Vuelta del conector: `?connected=1`. Se limpia de la URL para que un
  // refresco no repita el aviso.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      setJustConnected(true);
      queryClient.invalidateQueries({ queryKey: ["wa-channels"] });
      params.delete("connected");
      const limpia = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
      window.history.replaceState(null, "", limpia);
    }
  }, [queryClient]);

  // Aviso del conector (iframe) al terminar: cerrar el modal y refrescar sin
  // recargar.
  useEffect(() => {
    if (!hub) return;
    function onMessage(e: MessageEvent) {
      if (!hubOriginRef.current || e.origin !== hubOriginRef.current) return;
      if (e.data?.type !== "trimmo:whatsapp-connected") return;
      setHubUrl(null);
      setHubPending(false);
      setJustConnected(true);
      queryClient.invalidateQueries({ queryKey: ["wa-channels"] });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [hub, queryClient]);

  // Cerrar el modal a medias (Esc, la X o fuera): el botón vuelve a estar
  // disponible y se refresca la lista por si en realidad sí acabó.
  function cerrarConector() {
    setHubUrl(null);
    setHubPending(false);
    queryClient.invalidateQueries({ queryKey: ["wa-channels"] });
  }
  useEffect(() => {
    if (!hubUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setHubUrl(null);
      setHubPending(false);
      queryClient.invalidateQueries({ queryKey: ["wa-channels"] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hubUrl, queryClient]);

  // Cargar el SDK de Facebook (Embedded Signup). En SaaS no: ver `hub`.
  useEffect(() => {
    if (!APP_ID || hub) return;
    window.fbAsyncInit = () => {
      window.FB.init({
        appId: APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: GRAPH_VERSION,
      });
      setSdkReady(true);
    };
    if (document.getElementById("fb-sdk")) {
      if (window.FB) setSdkReady(true);
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

  // El Embedded Signup envía por postMessage el waba_id / phone_number_id.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!String(event.origin).includes("facebook.com")) return;
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.data) {
          signupRef.current = {
            phoneNumberId: data.data.phone_number_id,
            wabaId: data.data.waba_id,
          };
        }
      } catch {
        /* ignorar mensajes ajenos */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function launch() {
    if (hub) {
      // Al conector en el dominio raíz, con un pase de un solo uso, dentro de
      // un modal: el panel se queda aquí y se refresca al terminar. La ventana
      // de Meta la abre el propio conector con el clic del usuario dentro del
      // iframe, así que aquí no hay que pelearse con el bloqueador de
      // emergentes.
      setHubError(null);
      setHubPending(true);
      try {
        const t = await requestWhatsappConnectTicket();
        if (!t.connectUrl) throw new Error("El conector no está disponible");
        const url = new URL(t.connectUrl);
        url.searchParams.set("embed", "1");
        hubOriginRef.current = url.origin;
        setHubUrl(url.toString());
      } catch (e) {
        setHubError((e as Error).message);
        setHubPending(false);
      }
      return;
    }
    if (!window.FB || !CONFIG_ID) return;
    window.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;
        const { phoneNumberId, wabaId } = signupRef.current;
        if (code && phoneNumberId) {
          connect.mutate({ code, phoneNumberId, wabaId, mode: "coexistence" });
        }
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

  const missingConfig = !APP_ID || !CONFIG_ID;
  const list = channels ?? [];
  const connectError = connect.isError ? (connect.error as Error).message : hubError;
  // En SaaS el botón no depende del SDK: no hay SDK en esta página.
  const ready = hub || sdkReady;
  const connecting = connect.isPending || hubPending;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>Números de WhatsApp</h2>
        {!missingConfig && list.length > 0 && (
          <button onClick={launch} disabled={!ready || connecting} style={addBtn}>
            <WaIcon />
            {connecting ? "Conectando…" : "Añadir número"}
          </button>
        )}
      </div>
      <p style={{ color: "var(--muted)", marginTop: 6 }}>
        Conecta uno o varios números con <strong>Coexistencia</strong>: sigues
        usando la app de WhatsApp Business en cada celular y gestionas todo desde
        el CRM. Cada conversación se responde por el número por el que entró.
      </p>

      {connectError && (
        <p style={{ color: "#ff6b6b", fontSize: 13 }}>{connectError}</p>
      )}
      {justConnected && (
        <p style={{ color: "#7ee2a8", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <NavIcon name="check" size={14} />
          Número conectado. Ya puedes recibir y enviar mensajes desde el CRM.
        </p>
      )}

      <div style={card}>
        {isPending ? (
          <p style={{ color: "var(--muted)" }}>Verificando estado…</p>
        ) : missingConfig ? (
          <PendingConfig hasAppId={!!APP_ID} />
        ) : list.length === 0 ? (
          <Empty
            ready={ready}
            connecting={connecting}
            onConnect={launch}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map((ch) => (
              <ChannelRow
                key={ch.id}
                channel={ch}
                onUpdateToken={() => {
                  setEditing(ch);
                  setManualOpen(true);
                  // Que el formulario quede a la vista al abrirlo desde arriba.
                  requestAnimationFrame(() =>
                    manualRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    }),
                  );
                }}
                onDisconnect={() => disconnect.mutate(ch.phoneNumberId)}
                disconnecting={
                  disconnect.isPending &&
                  disconnect.variables === ch.phoneNumberId
                }
              />
            ))}
          </div>
        )}
      </div>

      {!missingConfig && list.length > 0 && (
        <>
          <div style={syncNote}>
            <strong style={{ color: "var(--text)" }}>
              Sincronización bidireccional activa
            </strong>
            <p style={{ margin: "6px 0 0" }}>
              Los mensajes que escribas desde la app de WhatsApp en el celular
              también aparecen en el CRM, y la IA se pausa automáticamente cuando
              respondes tú. Para que funcione, en Meta → WhatsApp → Configuración →
              Webhooks, suscribe los campos <code>messages</code> y{" "}
              <code>message_echoes</code>.
            </p>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 14 }}>
            Al conectar aceptas nuestra{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#3578ff" }}>
              Política de Privacidad
            </a>
            .
          </p>
        </>
      )}

      {/* Alta manual: para pruebas y para entornos sin Embedded Signup
          (en localhost el popup de Facebook no es viable). */}
      <div style={{ marginTop: 18 }} ref={manualRef}>
        <button
          onClick={() => {
            setManualOpen((v) => !v);
            setEditing(null);
          }}
          style={linkBtn}
        >
          {manualOpen ? "▾" : "▸"}{" "}
          {editing
            ? `Actualizar el token de ${editing.label ?? editing.phoneNumberId}`
            : "Añadir un número a mano (token de Meta)"}
        </button>
        {manualOpen && (
          <ManualConnect
            channel={editing}
            onDone={() => {
              setEditing(null);
              queryClient.invalidateQueries({ queryKey: ["wa-channels"] });
            }}
          />
        )}
      </div>

      <WebhookInfo />

      {hubUrl && (
        <div className="confirm-backdrop" onClick={cerrarConector}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Conectar WhatsApp"
            style={hubDialog}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={hubHead}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                <WaIcon />
                Conectar WhatsApp
              </span>
              <button onClick={cerrarConector} aria-label="Cerrar" style={hubClose}>
                <NavIcon name="x" size={16} />
              </button>
            </div>
            {/* El conector del dominio raíz: ahí sí arranca el SDK de Meta. */}
            <iframe src={hubUrl} title="Conectar WhatsApp" style={hubFrame} />
          </div>
        </div>
      )}
    </div>
  );
}

const hubDialog: React.CSSProperties = {
  width: 480,
  maxWidth: "100%",
  borderRadius: 12,
  background: "var(--bg)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow-card)",
  overflow: "hidden",
};

const hubHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderBottom: "1px solid var(--border)",
  background: "var(--panel)",
};

const hubClose: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  padding: 4,
  display: "inline-flex",
};

const hubFrame: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: 320,
  border: 0,
};

/**
 * Alta manual de un número con credenciales de Meta.
 * Útil para probar en local: el Embedded Signup exige una app registrada con
 * dominio HTTPS, mientras que aquí basta con pegar el token y el Phone number
 * ID que Meta muestra en el panel de la app.
 */
function ManualConnect({
  channel,
  onDone,
}: {
  /** Canal existente: solo hay que renovarle el token. */
  channel: WhatsappChannel | null;
  onDone: () => void;
}) {
  const renewing = !!channel;
  const [phoneNumberId, setPhoneNumberId] = useState(
    channel?.phoneNumberId ?? "",
  );
  const [accessToken, setAccessToken] = useState("");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(
    channel?.displayPhoneNumber ?? "",
  );
  const [label, setLabel] = useState(channel?.label ?? "");
  const [wabaId, setWabaId] = useState(channel?.wabaId ?? "");
  const [mode, setMode] = useState<"api" | "coexistence">(
    channel?.mode === "coexistence" ? "coexistence" : "api",
  );

  const save = useMutation({
    mutationFn: () =>
      connectWhatsapp({
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
        displayPhoneNumber: displayPhoneNumber.trim() || undefined,
        label: label.trim() || undefined,
        wabaId: wabaId.trim() || undefined,
        mode,
      }),
    onSuccess: () => {
      setAccessToken("");
      onDone();
    },
  });

  const ready = !!phoneNumberId.trim() && !!accessToken.trim();

  return (
    <div style={{ ...card, marginTop: 10 }}>
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
        {renewing ? (
          <>
            Pega el <strong>token nuevo</strong> de Meta → tu app → WhatsApp →{" "}
            <em>API Setup</em>. El resto de datos ya están rellenos: al guardar
            se <strong>actualiza este mismo número</strong>, no se duplica.
          </>
        ) : (
          <>
            En Meta → tu app → WhatsApp → <em>API Setup</em> están el{" "}
            <strong>Phone number ID</strong> y un <strong>token temporal</strong>{" "}
            (caduca en 24 h; para algo permanente, un token de usuario de
            sistema).
          </>
        )}
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px" }}>
          <label style={fieldLabel}>Phone number ID *</label>
          <input
            style={{ ...field, opacity: renewing ? 0.6 : 1 }}
            value={phoneNumberId}
            placeholder="106540352242922"
            readOnly={renewing}
            title={renewing ? "Identifica el canal que se actualiza" : undefined}
            onChange={(e) => setPhoneNumberId(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label style={fieldLabel}>Número visible</label>
          <input
            style={field}
            value={displayPhoneNumber}
            placeholder="+1 555 078 3881"
            onChange={(e) => setDisplayPhoneNumber(e.target.value)}
          />
        </div>
      </div>

      <label style={{ ...fieldLabel, marginTop: 10 }}>Access token *</label>
      <input
        autoFocus={renewing}
        style={{ ...field, fontFamily: "ui-monospace, monospace" }}
        type="password"
        autoComplete="off"
        value={accessToken}
        placeholder="EAAG…"
        onChange={(e) => setAccessToken(e.target.value)}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <div style={{ flex: "1 1 160px" }}>
          <label style={fieldLabel}>Alias</label>
          <input
            style={field}
            value={label}
            placeholder="Pruebas"
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label style={fieldLabel}>WABA ID</label>
          <input
            style={field}
            value={wabaId}
            placeholder="opcional"
            onChange={(e) => setWabaId(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 1 180px" }}>
          <label style={fieldLabel}>Modo</label>
          <select
            style={field}
            value={mode}
            onChange={(e) => setMode(e.target.value as "api" | "coexistence")}
          >
            <option value="api">API (número de prueba)</option>
            <option value="coexistence">Coexistencia (app del celular)</option>
          </select>
        </div>
      </div>

      {save.isError && (
        <p style={{ color: "#ff6b6b", fontSize: 13 }}>
          {(save.error as Error).message}
        </p>
      )}
      {save.isSuccess && (
        <p style={{ color: "#7ee2a8", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <NavIcon name="check" size={14} />
          {renewing ? "Token actualizado" : "Número conectado"}
        </p>
      )}

      <button
        onClick={() => save.mutate()}
        disabled={!ready || save.isPending}
        style={{ ...addBtn, marginTop: 12, opacity: ready ? 1 : 0.5 }}
      >
        {save.isPending
          ? "Guardando…"
          : renewing
            ? "Actualizar token"
            : "Conectar número"}
      </button>
    </div>
  );
}

/**
 * Lo que hay que pegar en Meta para recibir mensajes. En localhost la URL no
 * es accesible desde fuera, así que se avisa de que hace falta un túnel.
 */
function WebhookInfo() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocal = /localhost|127\.0\.0\.1/.test(origin);

  return (
    <div style={{ ...syncNote, borderColor: isLocal ? "#7a6f4a" : "#1f6f46" }}>
      <strong style={{ color: "var(--text)" }}>
        URL del webhook (para recibir mensajes)
      </strong>
      <p style={{ margin: "6px 0 0" }}>
        En Meta → WhatsApp → Configuración → Webhooks, pon como{" "}
        <strong>Callback URL</strong>:
      </p>
      <code style={urlBox}>
        {isLocal ? "https://TU-TUNEL.ngrok-free.app" : origin}
        /api/v1/whatsapp/webhook
      </code>
      <p style={{ margin: "8px 0 0" }}>
        El <strong>Verify token</strong> es el de Ajustes › Integraciones.
        Suscribe los campos <code>messages</code> y <code>message_echoes</code>.
      </p>
      {isLocal && (
        <p style={{ margin: "8px 0 0", color: "#e0b766" }}>
          <span style={{ marginRight: 6, verticalAlign: "-2px", display: "inline-block" }}>
            <NavIcon name="alert" size={14} />
          </span>
          Estás en localhost: Meta no puede alcanzar tu máquina. Para{" "}
          <strong>recibir</strong> mensajes necesitas exponer el puerto 3001 con
          un túnel, por ejemplo <code>ngrok http 3001</code> o{" "}
          <code>cloudflared tunnel --url http://localhost:3001</code>.{" "}
          <strong>Enviar</strong> sí funciona sin túnel.
        </p>
      )}
    </div>
  );
}

const urlBox: React.CSSProperties = {
  display: "block",
  marginTop: 8,
  padding: "8px 10px",
  borderRadius: 7,
  background: "#0d1320",
  border: "1px solid var(--border)",
  fontSize: 12,
  wordBreak: "break-all",
};

const linkBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  color: "var(--muted)",
  marginBottom: 5,
};

const field: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--field)",
  color: "var(--text)",
  fontSize: 14,
  boxSizing: "border-box",
};

const syncNote: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 10,
  border: "1px solid #1f6f46",
  background: "rgba(37,211,102,0.07)",
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.6,
};

function ChannelRow({
  channel,
  onDisconnect,
  onUpdateToken,
  disconnecting,
}: {
  channel: WhatsappChannel;
  onDisconnect: () => void;
  onUpdateToken: () => void;
  disconnecting: boolean;
}) {
  const online = channel.isActive && channel.status === "connected";
  const broken = channel.status === "error";
  const queryClient = useQueryClient();

  const test = useMutation({
    mutationFn: () => testWhatsappChannel(channel.phoneNumberId),
    // Probar puede cambiar el estado del canal (lo repara o lo marca roto).
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["wa-channels"] }),
  });

  return (
    <div style={row}>
      <span style={dot(online ? "#3578ff" : "#7a8aa0")} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 15 }}>
            {channel.label ||
              channel.displayPhoneNumber ||
              channel.phoneNumberId}
          </strong>
          <span style={pill(channel.source === "env" ? "#43506a" : "#1f6f46")}>
            {channel.mode === "coexistence" ? "Coexistencia" : "API"}
            {channel.source === "env" ? " · .env" : ""}
          </span>
          {!online && <span style={pill("#5a4a2a")}>Inactivo</span>}
          {broken && (
            <span
              style={{
                ...pill("#6b3232"),
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <NavIcon name="alert" size={12} />
              Token caducado
            </span>
          )}
        </div>
        {(channel.displayPhoneNumber || channel.label) && (
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
            {channel.displayPhoneNumber ?? channel.phoneNumberId}
          </div>
        )}
        {broken && (
          <div style={errorNote}>
            {channel.statusReason}
            <div style={{ marginTop: 4, opacity: 0.85 }}>
              Vuelve a conectarlo abajo con un token nuevo. Para no repetirlo
              cada 24 h, usa un token de usuario de sistema (no caduca).
            </div>
          </div>
        )}
        {test.data && (
          <div
            style={{
              ...errorNote,
              borderColor: test.data.ok ? "#2f6b52" : "#6b3232",
              background: test.data.ok
                ? "rgba(63,140,110,0.12)"
                : "rgba(200,80,80,0.12)",
              color: test.data.ok ? "#8fe6c0" : "#ffb3b3",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <NavIcon name={test.data.ok ? "check" : "x"} size={14} />
              {test.data.message}
            </span>
          </div>
        )}
      </div>
      <button
        onClick={() => test.mutate()}
        disabled={test.isPending}
        style={ghostBtn}
        title="Comprobar que el token sigue valiendo"
      >
        {test.isPending ? "…" : "Probar"}
      </button>
      {channel.source !== "env" && (
        <button
          onClick={onUpdateToken}
          style={broken ? primaryBtn : ghostBtn}
          title="Pegar un token nuevo para este número"
        >
          Actualizar token
        </button>
      )}
      {channel.source !== "env" && online && (
        <button onClick={onDisconnect} disabled={disconnecting} style={ghostBtn}>
          {disconnecting ? "…" : "Desconectar"}
        </button>
      )}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "8px 13px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const errorNote: React.CSSProperties = {
  marginTop: 6,
  padding: "7px 9px",
  borderRadius: 7,
  border: "1px solid #6b3232",
  background: "rgba(200,80,80,0.12)",
  color: "#ffb3b3",
  fontSize: 12.5,
  lineHeight: 1.45,
};

function Empty({
  ready,
  connecting,
  onConnect,
}: {
  ready: boolean;
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={dot("#7a8aa0")} />
        <strong style={{ fontSize: 16 }}>Sin números conectados</strong>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
        Pulsa el botón y se abrirá la ventana oficial de Meta. Elige tu cuenta y
        número, y <strong>escanea el QR con tu WhatsApp Business</strong> para
        activar la Coexistencia. Repite el proceso por cada número que quieras
        añadir.
      </p>
      <div>
        <button onClick={onConnect} disabled={!ready || connecting} style={waBtn}>
          <WaIcon />
          {connecting ? "Conectando…" : ready ? "Conectar WhatsApp" : "Cargando…"}
        </button>
      </div>
    </div>
  );
}

function PendingConfig({ hasAppId }: { hasAppId: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={dot("#e0a458")} />
        <strong style={{ fontSize: 16 }}>Configuración pendiente</strong>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
        Falta un dato de Meta para habilitar el botón de conexión:
      </p>
      <ol style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginTop: 0 }}>
        {!hasAppId && (
          <li>
            <code>NEXT_PUBLIC_WHATSAPP_APP_ID</code> en{" "}
            <code>apps/web/.env.local</code>.
          </li>
        )}
        <li>
          En tu App de Meta → <strong>Facebook Login for Business</strong> →
          <strong> Configurations</strong> → crea una configuración de Embedded
          Signup y copia su <strong>Config ID</strong>.
        </li>
        <li>
          Pégalo en <code>NEXT_PUBLIC_WHATSAPP_CONFIG_ID</code> (en{" "}
          <code>apps/web/.env.local</code>) y reinicia <code>npm run dev</code>.
        </li>
      </ol>
    </div>
  );
}

function WaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.8.9c.3.1.4.2.5.3 0 .2 0 .8-.2 1.6Z" />
    </svg>
  );
}

const card: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 22,
  boxShadow: "var(--shadow-card)",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.02)",
};

const waBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 20px",
  borderRadius: 10,
  border: "none",
  background: "#3578ff",
  color: "#f3f8ff",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};

const addBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px",
  borderRadius: 9,
  border: "none",
  background: "#3578ff",
  color: "#f3f8ff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "7px 13px",
  borderRadius: 8,
  border: "1px solid #5a2a2a",
  background: "transparent",
  color: "#e08a8a",
  cursor: "pointer",
  fontSize: 13,
  whiteSpace: "nowrap",
};

function dot(color: string): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  };
}

function pill(bg: string): React.CSSProperties {
  return {
    fontSize: 11,
    padding: "2px 9px",
    borderRadius: 999,
    background: bg,
    color: "#e9f1ff",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  };
}
