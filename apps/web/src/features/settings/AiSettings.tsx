"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  llmProviderLabels,
  llmProviderNames,
  suggestedModels,
  type AiConnectionTest,
  type AiSettingsDto,
  type ApiKeyState,
  type LlmProviderName,
} from "@crm/shared";
import { fetchAiSettings, testAiConnection, updateAiSettings } from "@/lib/bff";
import { toast } from "@/lib/toast";

/**
 * Ajustes › Inteligencia Artificial.
 * Elige el proveedor, guarda las API keys (cifradas en la BD) y comprueba
 * la conexión. Si una key está vacía aquí, se usa la del .env.
 */
export function AiSettings() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: fetchAiSettings,
  });

  const [provider, setProvider] = useState<LlmProviderName>("auto");
  const [openaiModel, setOpenaiModel] = useState("");
  const [anthropicModel, setAnthropicModel] = useState("");
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState("");
  // undefined = no se toca la key guardada; string = se enviará (vacío la borra).
  const [openaiKey, setOpenaiKey] = useState<string | undefined>(undefined);
  const [anthropicKey, setAnthropicKey] = useState<string | undefined>(undefined);
  const [test, setTest] = useState<AiConnectionTest | null>(null);

  useEffect(() => {
    if (!data) return;
    setProvider(data.provider);
    setOpenaiModel(data.openaiModel);
    setAnthropicModel(data.anthropicModel);
    setOpenaiBaseUrl(data.openaiBaseUrl ?? "");
    setOpenaiKey(undefined);
    setAnthropicKey(undefined);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      updateAiSettings({
        provider,
        openaiModel: openaiModel.trim() || undefined,
        anthropicModel: anthropicModel.trim() || undefined,
        openaiBaseUrl: openaiBaseUrl.trim() || null,
        ...(openaiKey !== undefined ? { openaiKey } : {}),
        ...(anthropicKey !== undefined ? { anthropicKey } : {}),
      }),
    onSuccess: (fresh: AiSettingsDto) => {
      queryClient.setQueryData(["ai-settings"], fresh);
      setTest(null);
      toast.success("Ajustes de IA guardados");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const check = useMutation({
    mutationFn: testAiConnection,
    onSuccess: (r) => setTest(r),
    onError: (e) => toast.error((e as Error).message),
  });

  if (isPending || !data) {
    return <Panel title="Inteligencia Artificial" subtitle="Cargando…" />;
  }

  const dirty =
    provider !== data.provider ||
    openaiModel !== data.openaiModel ||
    anthropicModel !== data.anthropicModel ||
    openaiBaseUrl !== (data.openaiBaseUrl ?? "") ||
    openaiKey !== undefined ||
    anthropicKey !== undefined;

  return (
    <Panel
      title="Inteligencia Artificial"
      subtitle="La API key que usarán los bots, el copilot del inbox y el asistente de flujos. Se guarda cifrada; si la dejas vacía se usa la del archivo .env."
    >
      {/* Estado actual */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span
            style={dot(
              data.activeProvider === "fake" ? "#b08a3f" : "#3f8c6e",
            )}
          />
          <strong style={{ fontSize: 14 }}>
            {data.activeProvider === "fake"
              ? "Sin API key — respuestas simuladas"
              : `Activo: ${llmProviderLabels[data.activeProvider]}`}
          </strong>
          {data.activeProvider !== "fake" && (
            <code style={chip}>{data.activeModel}</code>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => check.mutate()}
            disabled={check.isPending || dirty}
            style={ghostBtn}
            title={dirty ? "Guarda los cambios antes de probar" : "Hacer una llamada real de prueba"}
          >
            {check.isPending ? "Probando…" : "Probar conexión"}
          </button>
        </div>

        {test && (
          <div style={testBox(test.ok)}>
            {test.ok ? "✓" : "✕"} {test.message}
            {test.ok && (
              <span style={{ color: "var(--muted)" }}>
                {" "}
                · {test.model} · {test.latencyMs} ms
              </span>
            )}
          </div>
        )}
      </div>

      {/* Proveedor */}
      <div style={card}>
        <label style={label}>Proveedor</label>
        <select
          style={input}
          value={provider}
          onChange={(e) => setProvider(e.target.value as LlmProviderName)}
        >
          {llmProviderNames.map((p) => (
            <option key={p} value={p}>
              {llmProviderLabels[p]}
            </option>
          ))}
        </select>
        <p style={hint}>
          «Automático» usa OpenAI si hay key y, si no, Anthropic. Fuerza uno
          concreto si tienes las dos configuradas.
        </p>
      </div>

      {/* OpenAI */}
      <ProviderCard
        title="OpenAI"
        state={data.openaiKey}
        envVar="OPENAI_API_KEY"
        placeholder="sk-proj-…"
        value={openaiKey}
        onChange={setOpenaiKey}
        model={openaiModel}
        onModelChange={setOpenaiModel}
        models={suggestedModels.openai}
      >
        <label style={label}>URL base (opcional)</label>
        <input
          style={input}
          value={openaiBaseUrl}
          placeholder="https://api.openai.com/v1"
          onChange={(e) => setOpenaiBaseUrl(e.target.value)}
        />
        <p style={hint}>Solo si usas un gateway compatible con OpenAI.</p>
      </ProviderCard>

      {/* Anthropic */}
      <ProviderCard
        title="Anthropic (Claude)"
        state={data.anthropicKey}
        envVar="ANTHROPIC_API_KEY"
        placeholder="sk-ant-…"
        value={anthropicKey}
        onChange={setAnthropicKey}
        model={anthropicModel}
        onModelChange={setAnthropicModel}
        models={suggestedModels.anthropic}
      />

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
    </Panel>
  );
}

function ProviderCard({
  title,
  state,
  envVar,
  placeholder,
  value,
  onChange,
  model,
  onModelChange,
  models,
  children,
}: {
  title: string;
  state: ApiKeyState;
  envVar: string;
  placeholder: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  model: string;
  onModelChange: (v: string) => void;
  models: string[];
  children?: React.ReactNode;
}) {
  const editing = value !== undefined;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <strong style={{ fontSize: 14 }}>{title}</strong>
        <span style={badge(state.configured ? "#1f4d38" : "#3a3a3a")}>
          {state.source === "db"
            ? "Key guardada"
            : state.source === "env"
              ? `Desde ${envVar}`
              : "Sin key"}
        </span>
        {state.masked && (
          <code style={{ ...chip, color: "var(--muted)" }}>{state.masked}</code>
        )}
      </div>

      <label style={label}>API key</label>
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
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onChange("")} style={ghostBtn}>
            {state.source === "db" ? "Cambiar key" : "Introducir key"}
          </button>
          {state.source === "db" && (
            <span style={hint}>
              Deja el campo vacío al guardar para borrarla y volver a {envVar}.
            </span>
          )}
        </div>
      )}

      <label style={{ ...label, marginTop: 12 }}>Modelo por defecto</label>
      <input
        style={input}
        list={`${title}-models`}
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
      />
      <datalist id={`${title}-models`}>
        {models.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <p style={hint}>
        Se usa cuando el bot no fija uno propio, y para el asistente de flujos.
      </p>

      {children}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <header>
        <h3 style={{ margin: "0 0 4px" }}>{title}</h3>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>{subtitle}</p>
      </header>
      {children}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 14,
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

function dot(color: string): React.CSSProperties {
  return {
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
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
