"use client";

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
import { NavIcon, type IconName } from "@/components/NavIcons";

const NODE_META: Record<string, { icon: IconName; label: string }> = {
  start: { icon: "play", label: "Inicio" },
  sendMessage: { icon: "message", label: "Enviar mensaje" },
  askQuestion: { icon: "question", label: "Preguntar y guardar" },
  condition: { icon: "branch", label: "Condición" },
  action: { icon: "bolt", label: "Acción" },
  delay: { icon: "clock", label: "Esperar" },
  http: { icon: "globe", label: "Petición HTTP" },
  assign: { icon: "user", label: "Asignar a agente" },
  jumpToFlow: { icon: "jump", label: "Ir a otro flujo" },
};

const ACTION_LABEL: Record<string, string> = {
  ai: "Pasar a agente IA",
  handoff: "Pasar a humano",
  tag: "Poner etiqueta",
  move_deal: "Mover en pipeline",
};

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

export function NodeInspector({
  node,
  bots,
  stages,
  agents,
  flows,
  onChange,
  onDelete,
}: {
  node: Node;
  bots: FlowBotRef[];
  stages: { id: string; name: string }[];
  agents: FlowAgentRef[];
  flows: FlowSummary[];
  onChange: (data: FlowNodeData) => void;
  onDelete: () => void;
}) {
  const data = node.data as FlowNodeData;
  const patch = (p: Partial<FlowNodeData>) => onChange({ ...data, ...p });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <NavIcon name={NODE_META[node.type ?? ""]?.icon ?? "bolt"} size={16} />
        {NODE_META[node.type ?? ""]?.label ?? "Bloque"}
      </div>

      {node.type === "start" && (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Punto de inicio del flujo. Conecta su salida al primer bloque.
        </p>
      )}

      {node.type === "sendMessage" && (
        <Field label="Mensaje a enviar">
          <textarea
            style={{ ...input, minHeight: 110, resize: "vertical", fontFamily: "inherit" }}
            value={data.text ?? ""}
            placeholder="Hola {{nombre}}, ¿en qué te ayudo?"
            onChange={(e) => patch({ text: e.target.value })}
          />
        </Field>
      )}

      {node.type === "askQuestion" && (
        <>
          <Field label="Pregunta">
            <textarea
              style={{ ...input, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
              value={data.text ?? ""}
              placeholder="¿Cuál es tu nombre?"
              onChange={(e) => patch({ text: e.target.value })}
            />
          </Field>
          <Field label="Guardar respuesta en la variable">
            <input
              style={input}
              value={data.variable ?? ""}
              placeholder="nombre"
              onChange={(e) =>
                patch({ variable: e.target.value.replace(/[^\w]/g, "") })
              }
            />
          </Field>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>
            Úsala luego en otros mensajes como{" "}
            <code>{`{{${data.variable || "variable"}}}`}</code>.
          </p>
        </>
      )}

      {node.type === "condition" && (
        <ConditionFields
          branches={data.branches ?? []}
          onChange={(branches) => patch({ branches })}
        />
      )}

      {node.type === "action" && (
        <>
          <Field label="Acción">
            <select
              style={input}
              value={data.action ?? "ai"}
              onChange={(e) =>
                patch({ action: e.target.value as FlowNodeData["action"] })
              }
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
              style={{ ...input, minHeight: 50, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
              value={data.headers ?? ""}
              placeholder={'{ "Authorization": "Bearer ..." }'}
              onChange={(e) => patch({ headers: e.target.value })}
            />
          </Field>
          <Field label="Cuerpo (admite {{variables}}, opcional)">
            <textarea
              style={{ ...input, minHeight: 60, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
              value={data.httpBody ?? ""}
              placeholder={'{ "telefono": "{{telefono}}" }'}
              onChange={(e) => patch({ httpBody: e.target.value })}
            />
          </Field>
          <Field label="Guardar respuesta en variable (opcional)">
            <input
              style={input}
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
      )}

      {node.type !== "start" && (
        <button
          onClick={onDelete}
          style={{ ...ghost, color: "#e08a8a", borderColor: "#5a2a2a", marginTop: 6 }}
        >
          Eliminar bloque
        </button>
      )}
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
        Cada rama compara el mensaje del contacto con sus palabras clave. Conecta
        cada salida (●) al bloque siguiente. “En otro caso” es la salida por
        defecto.
      </p>
      {branches.map((b, i) => (
        <div
          key={b.id}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <input
            style={input}
            value={b.label}
            placeholder="Nombre de la rama (ej: Quiere precio)"
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <input
            style={input}
            value={b.keywords.join(", ")}
            placeholder="precio, costo, cuánto"
            onChange={(e) =>
              update(i, {
                keywords: e.target.value
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean),
              })
            }
          />
          <button
            onClick={() => onChange(branches.filter((_, idx) => idx !== i))}
            style={{ ...ghost, color: "#e08a8a", borderColor: "#5a2a2a", alignSelf: "flex-start" }}
          >
            Quitar rama
          </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      {children}
    </div>
  );
}
