"use client";

import { useEffect, useState } from "react";
import type { Node } from "@xyflow/react";
import {
  delayUnits,
  flowActionTypes,
  httpMethods,
  type FlowAgentRef,
  type FlowBotRef,
  type FlowBranch,
  type FlowNodeData,
  type FlowSummary,
} from "@crm/shared";
import { NavIcon } from "@/components/NavIcons";
import { NODE_META } from "./flowShared";

const ACTION_LABEL: Record<string, string> = {
  ai: "Pasar a agente IA",
  handoff: "Pasar a humano",
  tag: "Poner etiqueta",
  move_deal: "Mover en pipeline",
};

// Límite de un mensaje de texto en WhatsApp.
const WA_TEXT_MAX = 4096;

const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};
const lbl: React.CSSProperties = { fontSize: 12, color: "var(--muted)", marginBottom: 4 };
const ghost: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 12,
};
const iconBtn: React.CSSProperties = {
  ...ghost,
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 8px",
};

export function NodeInspector({
  node,
  bots,
  stages,
  agents,
  flows,
  variables,
  issues,
  onChange,
  onDelete,
  onDuplicate,
}: {
  node: Node;
  bots: FlowBotRef[];
  stages: { id: string; name: string }[];
  agents: FlowAgentRef[];
  flows: FlowSummary[];
  /** Variables definidas en el flujo, para insertarlas en los textos. */
  variables: string[];
  /** Avisos de este bloque (lo que falta para que funcione). */
  issues: string[];
  onChange: (data: FlowNodeData) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const data = node.data as FlowNodeData;
  const patch = (p: Partial<FlowNodeData>) => onChange({ ...data, ...p });
  const meta = NODE_META[node.type ?? ""];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: meta?.accent ?? "var(--text)", display: "inline-flex" }}>
          <NavIcon name={meta?.icon ?? "bolt"} size={16} />
        </span>
        <strong style={{ fontSize: 14, flex: 1 }}>{meta?.label ?? "Bloque"}</strong>
        {node.type !== "start" && (
          <>
            <button style={iconBtn} title="Duplicar (Ctrl+D)" onClick={onDuplicate}>
              <NavIcon name="copy" size={13} />
            </button>
            <button
              style={{ ...iconBtn, color: "#e08a8a", borderColor: "#5a2a2a" }}
              title="Eliminar (Supr)"
              onClick={onDelete}
            >
              <NavIcon name="x" size={13} />
            </button>
          </>
        )}
      </div>

      {issues.length > 0 && (
        <div style={issueBox}>
          {issues.map((i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>
                <NavIcon name="alert" size={13} />
              </span>
              {i}
            </div>
          ))}
        </div>
      )}

      {node.type === "start" && (
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          Punto de inicio del flujo. Pulsa su «+» o arrastra desde su salida
          al primer bloque.
        </p>
      )}

      {node.type === "sendMessage" && (
        <Field label="Mensaje a enviar">
          <textarea
            style={{ ...input, minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
            value={data.text ?? ""}
            maxLength={WA_TEXT_MAX}
            placeholder="Hola, ¿en qué te ayudo?"
            onChange={(e) => patch({ text: e.target.value })}
          />
          <Counter value={data.text ?? ""} />
          <VarChips variables={variables} onPick={(v) => patch({ text: `${data.text ?? ""}{{${v}}}` })} />
        </Field>
      )}

      {node.type === "askQuestion" && (
        <>
          <Field label="Pregunta">
            <textarea
              style={{ ...input, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
              value={data.text ?? ""}
              maxLength={WA_TEXT_MAX}
              placeholder="¿Cuál es tu nombre?"
              onChange={(e) => patch({ text: e.target.value })}
            />
            <VarChips variables={variables} onPick={(v) => patch({ text: `${data.text ?? ""}{{${v}}}` })} />
          </Field>
          <Field label="Guardar la respuesta en la variable">
            <input
              style={{ ...input, fontFamily: "ui-monospace, monospace" }}
              value={data.variable ?? ""}
              placeholder="nombre"
              onChange={(e) => patch({ variable: e.target.value.replace(/[^\w]/g, "") })}
            />
          </Field>
          <p style={hint}>
            Úsala luego en cualquier texto como{" "}
            <code>{`{{${data.variable || "variable"}}}`}</code>.
          </p>
        </>
      )}

      {node.type === "condition" && (
        <ConditionFields branches={data.branches ?? []} onChange={(branches) => patch({ branches })} />
      )}

      {node.type === "action" && (
        <>
          <Field label="Acción">
            <select
              style={input}
              value={data.action ?? "ai"}
              onChange={(e) => patch({ action: e.target.value as FlowNodeData["action"] })}
            >
              {flowActionTypes.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABEL[a]}
                </option>
              ))}
            </select>
          </Field>
          {data.action === "ai" && (
            <Field label="Agente que toma la conversación">
              <select
                style={input}
                value={data.botId ?? ""}
                onChange={(e) => patch({ botId: e.target.value || null })}
              >
                <option value="">Agente del canal / por defecto</option>
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {data.action === "handoff" && (
            <p style={hint}>
              La conversación pasa a Copilot y queda pendiente para una persona
              del equipo.
            </p>
          )}
          {data.action === "tag" && (
            <Field label="Etiqueta a poner">
              <input
                style={input}
                value={data.tag ?? ""}
                placeholder="interesado"
                onChange={(e) => patch({ tag: e.target.value })}
              />
            </Field>
          )}
          {data.action === "move_deal" && (
            <Field label="Mover el deal a la etapa">
              <select
                style={input}
                value={data.stageId ?? ""}
                onChange={(e) => patch({ stageId: e.target.value })}
              >
                <option value="">Elige una etapa…</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}

      {node.type === "delay" && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <div style={lbl}>Esperar</div>
              <input
                type="number"
                min={1}
                style={input}
                value={data.delayValue ?? 5}
                onChange={(e) => patch({ delayValue: Number(e.target.value) })}
              />
            </div>
            <select
              style={{ ...input, width: 120 }}
              value={data.delayUnit ?? "minutes"}
              onChange={(e) => patch({ delayUnit: e.target.value as FlowNodeData["delayUnit"] })}
            >
              {delayUnits.map((u) => (
                <option key={u} value={u}>
                  {u === "hours" ? "horas" : "minutos"}
                </option>
              ))}
            </select>
          </div>
          <p style={hint}>
            Si el contacto escribe durante la espera, el flujo sigue con su
            mensaje.
          </p>
        </>
      )}

      {node.type === "http" && (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 110 }}>
              <div style={lbl}>Método</div>
              <select
                style={input}
                value={data.method ?? "POST"}
                onChange={(e) => patch({ method: e.target.value as FlowNodeData["method"] })}
              >
                {httpMethods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={lbl}>URL</div>
              <input
                style={input}
                value={data.url ?? ""}
                placeholder="https://tu-n8n.com/webhook/..."
                onChange={(e) => patch({ url: e.target.value })}
              />
            </div>
          </div>
          <Field label="Cabeceras (JSON, opcional)">
            <textarea
              style={{ ...input, minHeight: 50, resize: "vertical", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              value={data.headers ?? ""}
              placeholder={'{ "Authorization": "Bearer ..." }'}
              onChange={(e) => patch({ headers: e.target.value })}
            />
          </Field>
          <Field label="Cuerpo (admite {{variables}}, opcional)">
            <textarea
              style={{ ...input, minHeight: 60, resize: "vertical", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              value={data.httpBody ?? ""}
              placeholder={'{ "telefono": "{{telefono}}" }'}
              onChange={(e) => patch({ httpBody: e.target.value })}
            />
            <VarChips variables={variables} onPick={(v) => patch({ httpBody: `${data.httpBody ?? ""}{{${v}}}` })} />
          </Field>
          <Field label="Guardar la respuesta en la variable (opcional)">
            <input
              style={{ ...input, fontFamily: "ui-monospace, monospace" }}
              value={data.saveAs ?? ""}
              placeholder="respuesta_api"
              onChange={(e) => patch({ saveAs: e.target.value.replace(/[^\w]/g, "") })}
            />
          </Field>
        </>
      )}

      {node.type === "assign" && (
        <Field label="Asignar la conversación a">
          <select
            style={input}
            value={data.agentId ?? ""}
            onChange={(e) => {
              const a = agents.find((x) => x.id === e.target.value);
              patch({ agentId: e.target.value || null, agentName: a?.name ?? a?.email });
            }}
          >
            <option value="">Elige un agente…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.email}
              </option>
            ))}
          </select>
        </Field>
      )}

      {node.type === "jumpToFlow" && (
        <>
          <Field label="Continuar en el flujo">
            <select
              style={input}
              value={data.flowId ?? ""}
              onChange={(e) => {
                const f = flows.find((x) => x.id === e.target.value);
                patch({ flowId: e.target.value, flowName: f?.name });
              }}
            >
              <option value="">Elige un flujo…</option>
              {flows.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <p style={hint}>Este bloque no tiene salida: el otro flujo toma el control.</p>
        </>
      )}
    </div>
  );
}

/** Variables del flujo como chips: un clic las inserta al final del texto. */
function VarChips({ variables, onPick }: { variables: string[]; onPick: (v: string) => void }) {
  if (!variables.length) {
    return (
      <p style={hint}>
        Las respuestas guardadas con «Preguntar y guardar» aparecerán aquí para
        insertarlas.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      <span style={{ ...hint, margin: 0, alignSelf: "center" }}>Insertar:</span>
      {variables.map((v) => (
        <button key={v} style={chipBtn} onClick={() => onPick(v)} title={`Insertar {{${v}}}`}>
          {`{{${v}}}`}
        </button>
      ))}
    </div>
  );
}

function Counter({ value }: { value: string }) {
  const n = value.length;
  return (
    <div style={{ ...hint, textAlign: "right", color: n > WA_TEXT_MAX * 0.9 ? "#e0b766" : "var(--muted)" }}>
      {n} / {WA_TEXT_MAX}
    </div>
  );
}

function ConditionFields({
  branches,
  onChange,
}: {
  branches: FlowBranch[];
  onChange: (b: FlowBranch[]) => void;
}) {
  function update(i: number, p: Partial<FlowBranch>) {
    onChange(branches.map((b, idx) => (idx === i ? { ...b, ...p } : b)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= branches.length) return;
    const next = [...branches];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ ...hint, margin: 0 }}>
        Cada rama compara el mensaje del contacto con sus palabras clave, en
        orden: gana la primera que coincide. «En otro caso» es la salida por
        defecto. Conecta cada salida (●) o usa su «+».
      </p>
      {branches.map((b, i) => (
        <div key={b.id} style={branchBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ ...lbl, margin: 0, flex: 1 }}>Rama {i + 1}</span>
            <button style={miniBtn} title="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
              <NavIcon name="arrow-up" size={12} />
            </button>
            <button style={miniBtn} title="Bajar" disabled={i === branches.length - 1} onClick={() => move(i, 1)}>
              <NavIcon name="arrow-down" size={12} />
            </button>
            <button
              style={{ ...miniBtn, color: "#e08a8a" }}
              title="Quitar rama"
              onClick={() => onChange(branches.filter((_, idx) => idx !== i))}
            >
              <NavIcon name="x" size={12} />
            </button>
          </div>
          <input
            style={input}
            value={b.label}
            placeholder="Nombre (ej: Quiere precio)"
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <KeywordsInput keywords={b.keywords} onChange={(keywords) => update(i, { keywords })} />
        </div>
      ))}
      <button
        onClick={() =>
          onChange([
            ...branches,
            { id: `b_${Math.random().toString(36).slice(2, 8)}`, label: "", keywords: [] },
          ])
        }
        style={ghost}
      >
        + Añadir rama
      </button>
    </div>
  );
}

/**
 * Palabras clave separadas por comas. El texto que se teclea es local: si el
 * campo mostrara siempre `keywords.join(", ")`, la coma y el espacio
 * desaparecerían en cuanto se pulsan (se normalizan antes de verse). Solo se
 * resincroniza cuando el valor cambia desde fuera (deshacer, otra rama).
 */
function KeywordsInput({ keywords, onChange }: { keywords: string[]; onChange: (k: string[]) => void }) {
  const parse = (s: string) => s.split(",").map((k) => k.trim()).filter(Boolean);
  const [text, setText] = useState(keywords.join(", "));
  useEffect(() => {
    if (parse(text).join("\u0000") !== keywords.join("\u0000")) setText(keywords.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywords]);
  return (
    <input
      style={input}
      value={text}
      placeholder="palabras clave: precio, costo, cuánto"
      onChange={(e) => {
        setText(e.target.value);
        onChange(parse(e.target.value));
      }}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      {children}
    </div>
  );
}

const hint: React.CSSProperties = { color: "var(--muted)", fontSize: 12, margin: "6px 0 0", lineHeight: 1.45 };

const issueBox: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #7a6f4a",
  background: "rgba(224,183,102,0.08)",
  color: "#e0b766",
  fontSize: 12.5,
  lineHeight: 1.4,
};

const branchBox: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const miniBtn: React.CSSProperties = {
  ...ghost,
  padding: "3px 6px",
  display: "inline-flex",
  alignItems: "center",
};

const chipBtn: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--field)",
  color: "#7ee2a8",
  fontSize: 11.5,
  fontFamily: "ui-monospace, monospace",
  cursor: "pointer",
};
