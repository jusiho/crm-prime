"use client";

import { NavIcon } from "@/components/NavIcons";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ApiKeyState,
  IntegrationSettingsDto,
  IntegrationTestResult,
} from "@crm/shared";
import {
  fetchIntegrationSettings,
  testIntegration,
  updateIntegrationSettings,
} from "@/lib/bff";
import { toast } from "@/lib/toast";

/**
 * Ajustes › Integraciones. Credenciales que el CRM usa para llamar a
 * terceros. Se guardan cifradas; si se dejan vacías se usa el .env.
 *
 * El token de WhatsApp por número NO está aquí: vive en cada canal
 * (pestaña Canales). Aquí solo lo que es a nivel de app de Meta.
 */
export function IntegrationsSettings() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["integration-settings"],
    queryFn: fetchIntegrationSettings,
  });

  const [voyageModel, setVoyageModel] = useState("");
  const [appId, setAppId] = useState("");
  const [graphVersion, setGraphVersion] = useState("");
  // undefined = no se toca el secreto guardado; "" lo borra.
  const [voyageKey, setVoyageKey] = useState<string | undefined>();
  const [appSecret, setAppSecret] = useState<string | undefined>();
  const [verifyToken, setVerifyToken] = useState<string | undefined>();
  const [test, setTest] = useState<IntegrationTestResult | null>(null);

  useEffect(() => {
    if (!data) return;
    setVoyageModel(data.voyageModel);
    setAppId(data.whatsappAppId ?? "");
    setGraphVersion(data.whatsappGraphVersion);
    setVoyageKey(undefined);
    setAppSecret(undefined);
    setVerifyToken(undefined);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      updateIntegrationSettings({
        voyageModel: voyageModel.trim() || undefined,
        whatsappAppId: appId.trim() || null,
        whatsappGraphVersion: graphVersion.trim() || undefined,
        ...(voyageKey !== undefined ? { voyageKey } : {}),
        ...(appSecret !== undefined ? { whatsappAppSecret: appSecret } : {}),
        ...(verifyToken !== undefined
          ? { whatsappVerifyToken: verifyToken }
          : {}),
      }),
    onSuccess: (fresh: IntegrationSettingsDto) => {
      queryClient.setQueryData(["integration-settings"], fresh);
      setTest(null);
      toast.success("Integraciones guardadas");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const check = useMutation({
    mutationFn: testIntegration,
    onSuccess: setTest,
    onError: (e) => toast.error((e as Error).message),
  });

  if (isPending || !data) {
    return (
      <div>
        <h3 style={{ margin: "0 0 4px" }}>Integraciones</h3>
        <p style={muted}>Cargando…</p>
      </div>
    );
  }

  const dirty =
    voyageModel !== data.voyageModel ||
    appId !== (data.whatsappAppId ?? "") ||
    graphVersion !== data.whatsappGraphVersion ||
    voyageKey !== undefined ||
    appSecret !== undefined ||
    verifyToken !== undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <header>
        <h3 style={{ margin: "0 0 4px" }}>Integraciones</h3>
        <p style={muted}>
          Credenciales que el CRM usa para llamar a otros servicios. Se guardan
          cifradas; si las dejas vacías se usa lo que haya en el archivo .env.
        </p>
      </header>

      {/* ── Embeddings ─────────────────────────────────────── */}
      <div style={card}>
        <div style={rowHead}>
          <strong style={{ fontSize: 14 }}>Embeddings (Voyage AI)</strong>
          <span
            style={badge(
              data.embeddingsProvider === "voyage" ? "#1f4d38" : "#5a4a2a",
            )}
          >
            {data.embeddingsProvider === "voyage" ? "Activo" : "Simulado"}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => check.mutate()}
            disabled={check.isPending || dirty}
            style={ghostBtn}
            title={dirty ? "Guarda los cambios antes de probar" : undefined}
          >
            {check.isPending ? "Probando…" : "Probar conexión"}
          </button>
        </div>
        <p style={hint}>
          Convierte tu base de conocimiento en vectores para que el bot
          encuentre la respuesta correcta. Sin key, la búsqueda es pobre.
        </p>

        <SecretField
          label="API key"
          state={data.voyageKey}
          envVar="VOYAGE_API_KEY"
          placeholder="pa-…"
          value={voyageKey}
          onChange={setVoyageKey}
        />

        <label style={{ ...label, marginTop: 12 }}>Modelo</label>
        <input
          style={input}
          value={voyageModel}
          onChange={(e) => setVoyageModel(e.target.value)}
        />

        {test && (
          <div style={{ ...testBox(test.ok), display: "flex", alignItems: "center", gap: 6 }}>
            <NavIcon name={test.ok ? "check" : "x"} size={14} />
            {test.message}
          </div>
        )}

        {data.embeddingsProvider === "voyage" && (
          <p style={{ ...hint, color: "#e0b766", display: "flex", alignItems: "flex-start", gap: 6 }}>
            <NavIcon name="alert" size={14} />
            Si cambias de embedder (o pones/quitas la key), los vectores
            antiguos dejan de ser comparables: hay que reindexar la base de
            conocimiento.
          </p>
        )}
      </div>

      {/* ── WhatsApp a nivel de app ────────────────────────── */}
      <div style={card}>
        <div style={rowHead}>
          <strong style={{ fontSize: 14 }}>WhatsApp (nivel de app)</strong>
          <span style={badge(data.webhookSignatureVerified ? "#1f4d38" : "#5a4a2a")}>
            {data.webhookSignatureVerified
              ? "Firma verificada"
              : "Firma SIN verificar"}
          </span>
        </div>
        <p style={hint}>
          El token para <em>enviar</em> mensajes va en cada número, en la
          pestaña Canales. Esto es lo de la app de Meta, común a todos.
        </p>

        {!data.webhookSignatureVerified && (
          <div style={testBox(false)}>
            Sin app secret, cualquiera que conozca tu URL puede enviarte
            webhooks falsos. Configúralo antes de salir a producción.
          </div>
        )}

        <SecretField
          label="App secret"
          state={data.whatsappAppSecret}
          envVar="WHATSAPP_APP_SECRET"
          placeholder="32 caracteres hex"
          value={appSecret}
          onChange={setAppSecret}
        />

        <div style={{ marginTop: 12 }}>
          <SecretField
            label="Verify token (el que pones en Meta al dar de alta el webhook)"
            state={data.whatsappVerifyToken}
            envVar="WHATSAPP_VERIFY_TOKEN"
            placeholder="una cadena que elijas tú"
            value={verifyToken}
            onChange={setVerifyToken}
          />
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={label}>App ID</label>
            <input
              style={input}
              value={appId}
              placeholder="1234567890"
              onChange={(e) => setAppId(e.target.value)}
            />
          </div>
          <div style={{ flex: "0 1 140px" }}>
            <label style={label}>Versión de Graph</label>
            <input
              style={input}
              value={graphVersion}
              placeholder="v21.0"
              onChange={(e) => setGraphVersion(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          style={{ ...primaryBtn, opacity: dirty ? 1 : 0.5 }}
        >
          {save.isPending ? "Guardando…" : "Guardar cambios"}
        </button>
        {dirty && <span style={hint}>Hay cambios sin guardar.</span>}
      </div>
    </div>
  );
}

// Campo de secreto: enmascarado, se sustituye pero nunca se muestra.
function SecretField({
  label: text,
  state,
  envVar,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  state: ApiKeyState;
  envVar: string;
  placeholder: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const editing = value !== undefined;

  return (
    <div>
      <label style={label}>{text}</label>
      {editing ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...input, fontFamily: "ui-monospace, monospace" }}
            type="password"
            autoComplete="off"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
          <button onClick={() => onChange(undefined)} style={ghostBtn}>
            Cancelar
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={badge(state.configured ? "#1f4d38" : "#3a3a3a")}>
            {state.source === "db"
              ? "Guardado"
              : state.source === "env"
                ? `Desde ${envVar}`
                : "Sin configurar"}
          </span>
          {state.masked && <code style={chip}>{state.masked}</code>}
          <button onClick={() => onChange("")} style={ghostBtn}>
            {state.source === "db" ? "Cambiar" : "Configurar"}
          </button>
          {state.source === "db" && (
            <span style={hint}>Guarda vacío para borrarlo y volver a {envVar}.</span>
          )}
        </div>
      )}
    </div>
  );
}

const muted: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 14,
  marginTop: 0,
};

const card: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 14,
};

const rowHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 8,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  color: "var(--muted)",
  marginBottom: 5,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--field)",
  color: "var(--text)",
  fontSize: 14,
  boxSizing: "border-box",
};

const hint: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  margin: "6px 0 0",
  lineHeight: 1.45,
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 13px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const chip: React.CSSProperties = {
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 6,
  background: "var(--field)",
  border: "1px solid var(--border)",
};

function badge(bg: string): React.CSSProperties {
  return {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: bg,
    color: "#eaf2ff",
    whiteSpace: "nowrap",
  };
}

function testBox(ok: boolean): React.CSSProperties {
  return {
    marginTop: 11,
    padding: "9px 11px",
    borderRadius: 8,
    fontSize: 13,
    background: ok ? "rgba(63,140,110,0.14)" : "rgba(200,80,80,0.14)",
    border: `1px solid ${ok ? "#2f6b52" : "#6b3232"}`,
    color: ok ? "#8fe6c0" : "#ffb3b3",
  };
}
