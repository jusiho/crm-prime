"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  effortValues,
  type AgentConfigDto,
  type UpdateAgentConfigInput,
} from "@crm/shared";
import { fetchAgentConfig, updateAgentConfig } from "@/lib/bff";

const MODELS = [
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
];

type Form = {
  name: string;
  model: string;
  effort: string;
  systemPrompt: string;
  enabledTools: string[];
  maxIterations: number;
  escalateOnNegativeSentiment: boolean;
  minConfidence: number;
  keywords: string;
  monthlyTokenBudget: number;
};

function toForm(c: AgentConfigDto): Form {
  return {
    name: c.name,
    model: c.model,
    effort: c.effort,
    systemPrompt: c.systemPrompt,
    enabledTools: c.enabledTools,
    maxIterations: c.maxIterations,
    escalateOnNegativeSentiment:
      c.escalationRules.escalateOnNegativeSentiment ?? false,
    minConfidence: c.escalationRules.minConfidence ?? 0.6,
    keywords: (c.escalationRules.keywords ?? []).join(", "),
    monthlyTokenBudget: c.monthlyTokenBudget,
  };
}

export function AgentConfigDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} style={triggerBtn}>
        ⚙️ Agente IA
      </button>
      {open && <Drawer onClose={() => setOpen(false)} />}
    </>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["agent-config"],
    queryFn: fetchAgentConfig,
  });
  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  const save = useMutation({
    mutationFn: (input: UpdateAgentConfigInput) => updateAgentConfig(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-config"] });
      onClose();
    },
  });

  function submit() {
    if (!form) return;
    save.mutate({
      name: form.name,
      model: form.model,
      effort: form.effort as UpdateAgentConfigInput["effort"],
      systemPrompt: form.systemPrompt,
      enabledTools: form.enabledTools,
      maxIterations: Number(form.maxIterations),
      monthlyTokenBudget: Number(form.monthlyTokenBudget),
      escalationRules: {
        escalateOnNegativeSentiment: form.escalateOnNegativeSentiment,
        minConfidence: Number(form.minConfidence),
        keywords: form.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      },
    });
  }

  function toggleTool(name: string) {
    setForm((f) =>
      f
        ? {
            ...f,
            enabledTools: f.enabledTools.includes(name)
              ? f.enabledTools.filter((t) => t !== name)
              : [...f.enabledTools, name],
          }
        : f,
    );
  }

  return (
    <>
      <div style={backdrop} onClick={onClose} />
      <aside style={drawer}>
        <header style={drawerHeader}>
          <strong>Agente IA</strong>
          <button onClick={onClose} style={closeBtn}>
            ✕
          </button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {isPending && <p style={{ color: "var(--muted)" }}>Cargando…</p>}
          {isError && (
            <p style={{ color: "#ff6b6b" }}>{(error as Error).message}</p>
          )}
          {form && data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Nombre">
                <input
                  style={input}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>

              <div style={{ display: "flex", gap: 12 }}>
                <Field label="Modelo" style={{ flex: 1 }}>
                  <select
                    style={input}
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                  >
                    {MODELS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Effort" style={{ width: 130 }}>
                  <select
                    style={input}
                    value={form.effort}
                    onChange={(e) => setForm({ ...form, effort: e.target.value })}
                  >
                    {effortValues.map((ef) => (
                      <option key={ef} value={ef}>
                        {ef}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="System prompt">
                <textarea
                  style={{ ...input, minHeight: 140, resize: "vertical", fontFamily: "inherit" }}
                  value={form.systemPrompt}
                  onChange={(e) =>
                    setForm({ ...form, systemPrompt: e.target.value })
                  }
                />
              </Field>

              <Field label="Herramientas habilitadas">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.availableTools.map((t) => (
                    <label key={t.name} style={toolRow}>
                      <input
                        type="checkbox"
                        checked={form.enabledTools.includes(t.name)}
                        onChange={() => toggleTool(t.name)}
                      />
                      <span>
                        <code style={{ color: "var(--accent)" }}>{t.name}</code>
                        <div style={{ color: "var(--muted)", fontSize: 12 }}>
                          {t.description}
                        </div>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Máx. iteraciones del bucle agéntico">
                <input
                  type="number"
                  min={1}
                  max={20}
                  style={input}
                  value={form.maxIterations}
                  onChange={(e) =>
                    setForm({ ...form, maxIterations: Number(e.target.value) })
                  }
                />
              </Field>

              <div style={sectionBox}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Escalado</div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.escalateOnNegativeSentiment}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        escalateOnNegativeSentiment: e.target.checked,
                      })
                    }
                  />
                  Escalar si el sentimiento es negativo
                </label>
                <Field label="Confianza mínima (0–1)">
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    style={input}
                    value={form.minConfidence}
                    onChange={(e) =>
                      setForm({ ...form, minConfidence: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Palabras clave de escalado (separadas por coma)">
                  <input
                    style={input}
                    value={form.keywords}
                    onChange={(e) =>
                      setForm({ ...form, keywords: e.target.value })
                    }
                    placeholder="humano, reclamo, agente"
                  />
                </Field>
              </div>

              <Field label="Presupuesto de tokens / mes (0 = sin límite)">
                <input
                  type="number"
                  min={0}
                  style={input}
                  value={form.monthlyTokenBudget}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      monthlyTokenBudget: Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
          )}
        </div>

        <footer style={drawerFooter}>
          {save.isError && (
            <span style={{ color: "#ff6b6b", fontSize: 13 }}>
              {(save.error as Error).message}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={ghostBtn}>
            Cancelar
          </button>
          <button onClick={submit} disabled={save.isPending || !form} style={saveBtn}>
            {save.isPending ? "Guardando…" : "Guardar"}
          </button>
        </footer>
      </aside>
    </>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
      {children}
    </label>
  );
}

const triggerBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#16203a",
  color: "#a9c3ff",
  fontSize: 13,
  cursor: "pointer",
};

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  zIndex: 40,
};

const drawer: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  height: "100vh",
  width: 460,
  maxWidth: "92vw",
  background: "var(--bg)",
  borderLeft: "1px solid var(--border)",
  zIndex: 41,
  display: "flex",
  flexDirection: "column",
  boxShadow: "-8px 0 24px rgba(0,0,0,0.4)",
};

const drawerHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px",
  borderBottom: "1px solid var(--border)",
  fontSize: 16,
};

const drawerFooter: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 16,
  borderTop: "1px solid var(--border)",
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  fontSize: 18,
  cursor: "pointer",
};

const input: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const toolRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 8,
};

const sectionBox: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const saveBtn: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
};
