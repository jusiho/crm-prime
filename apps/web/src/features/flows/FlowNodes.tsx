"use client";

import { useContext, useEffect } from "react";
import {
  Handle,
  NodeToolbar,
  Position,
  useConnection,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import type { FlowBranch, FlowNodeData } from "@crm/shared";
import { NavIcon } from "@/components/NavIcons";
import { ACTION_LABEL, FlowActionsContext, NODE_META, STATUS_LABEL, VALIDATION_LABEL, branchTitle } from "./flowShared";

/** "+" en una salida: abre el menú de bloques anclado al botón. */
function AddNextButton({
  sourceId,
  sourceHandle,
  placement = "bottom",
}: {
  sourceId: string;
  sourceHandle?: string;
  placement?: "bottom" | "right";
}) {
  const actions = useContext(FlowActionsContext);
  // Una salida solo puede enlazar un bloque: si ya tiene conexión, no hay "+".
  if (!actions || actions.isOutgoingTaken(sourceId, sourceHandle)) return null;

  const anchor: React.CSSProperties =
    placement === "right"
      ? { right: -24, top: "50%", transform: "translateY(-50%)" }
      : { bottom: -26, left: "50%", transform: "translateX(-50%)" };

  return (
    <button
      className="nodrag nopan"
      style={{ ...plusBtn, position: "absolute", ...anchor }}
      title="Añadir el siguiente bloque"
      onClick={(e) => {
        e.stopPropagation();
        actions.openAddMenu({
          sourceId,
          sourceHandle,
          anchor: { x: e.clientX, y: e.clientY },
        });
      }}
    >
      +
    </button>
  );
}

/**
 * Marco común de todos los bloques: borde por tipo, barra de herramientas al
 * seleccionar (duplicar / eliminar) y el aviso de que algo falta.
 */
function Shell({
  id,
  type,
  selected,
  minWidth,
  children,
}: {
  id: string;
  type: string;
  selected?: boolean;
  minWidth?: number;
  children: React.ReactNode;
}) {
  const actions = useContext(FlowActionsContext);
  const meta = NODE_META[type];
  const issues = actions?.issuesFor(id) ?? [];
  // Mientras se arrastra una conexión desde otro bloque, este entero es un
  // destino válido: basta soltar encima, sin apuntar al punto de entrada.
  const connection = useConnection();
  const dropping = connection.inProgress && connection.fromNode?.id !== id && type !== "start";
  return (
    <div style={shell(!!selected, meta?.color ?? "#3a4c6a", minWidth)}>
      {type !== "start" && (
        <Handle
          type="target"
          position={Position.Top}
          id="body"
          isConnectableStart={false}
          className="flow-body-target"
          style={{ pointerEvents: dropping ? "all" : "none" }}
        />
      )}
      {type !== "start" && (
        <NodeToolbar isVisible={!!selected} position={Position.Top} offset={8}>
          <div style={toolbar}>
            <button style={toolBtn} title="Duplicar (Ctrl+D)" onClick={() => actions?.duplicateNode(id)}>
              <NavIcon name="copy" size={13} /> Duplicar
            </button>
            <button
              style={{ ...toolBtn, color: "#e08a8a" }}
              title="Eliminar (Supr)"
              onClick={() => actions?.deleteNode(id)}
            >
              <NavIcon name="x" size={13} /> Eliminar
            </button>
          </div>
        </NodeToolbar>
      )}
      {issues.length > 0 && (
        <span style={issueDot} title={issues.join("\n")}>
          !
        </span>
      )}
      {children}
    </div>
  );
}

function Head({ type }: { type: string }) {
  const meta = NODE_META[type];
  return (
    <div style={{ ...head, color: meta.accent }}>
      <NavIcon name={meta.icon} size={15} />
      {meta.label}
    </div>
  );
}

/** Texto del bloque recortado a tres líneas: el detalle va en el inspector. */
function Clamp({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

const placeholder: React.CSSProperties = { opacity: 0.5, fontStyle: "italic" };

export function StartNode({ id, selected }: NodeProps) {
  return (
    <Shell id={id} type="start" selected={selected} minWidth={130}>
      <div style={{ ...head, color: NODE_META.start.accent, borderBottom: "none", justifyContent: "center" }}>
        <NavIcon name="play" size={14} />
        Inicio
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} />
    </Shell>
  );
}

export function SendMessageNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <Shell id={id} type="sendMessage" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="sendMessage" />
      <div style={body}>
        {d.mediaUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#9ad8e8", marginBottom: 4, fontSize: 11.5 }}>
            <NavIcon name={d.mediaKind === "DOCUMENT" ? "file" : "image"} size={12} />
            {d.mediaName || (d.mediaKind === "DOCUMENT" ? "Archivo" : "Imagen")}
          </div>
        )}
        {d.text ? <Clamp>{d.text}</Clamp> : !d.mediaUrl && <i style={placeholder}>Sin texto…</i>}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} />
    </Shell>
  );
}

export function SendTemplateNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <Shell id={id} type="sendTemplate" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="sendTemplate" />
      <div style={body}>{d.templateName ? <Clamp>{d.templateName}</Clamp> : <i style={placeholder}>Sin plantilla…</i>}</div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} />
    </Shell>
  );
}

export function AskQuestionNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <Shell id={id} type="askQuestion" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="askQuestion" />
      <div style={body}>
        {d.text ? <Clamp>{d.text}</Clamp> : <i style={placeholder}>Sin pregunta…</i>}
        {d.variable && (
          <div style={{ marginTop: 5, color: "#7ee2a8", fontFamily: "ui-monospace, monospace" }}>
            → {`{{${d.variable}}}`}
          </div>
        )}
        {d.validate && d.validate !== "any" && (
          <div style={{ marginTop: 4, fontSize: 11, color: "#cbb6ff" }}>
            Espera: {VALIDATION_LABEL[d.validate]?.toLowerCase()}
          </div>
        )}
      </div>
      {d.validate && d.validate !== "any" && (
        <div style={{ position: "relative", height: 26, display: "flex", alignItems: "center", padding: "0 10px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ ...branchText, color: "#e0b766" }}>si no es válida</span>
          <Handle type="source" position={Position.Right} id="invalid" style={{ ...handleStyle, background: "#e0b766", top: 13 }} />
          <AddNextButton sourceId={id} sourceHandle="invalid" placement="right" />
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} />
    </Shell>
  );
}

export function ConditionNode({ id, data, selected }: NodeProps) {
  const branches = ((data as FlowNodeData).branches ?? []) as FlowBranch[];
  // Cada rama es un handle: al añadir o quitar ramas hay que decirle a React
  // Flow que vuelva a medir dónde están, o las conexiones se quedan colgando
  // del sitio antiguo.
  const updateInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateInternals(id);
  }, [branches.length, id, updateInternals]);

  const rowH = 28;
  return (
    <Shell id={id} type="condition" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="condition" />
      <div style={{ padding: "6px 10px 8px" }}>
        {branches.length === 0 && <i style={{ ...placeholder, fontSize: 11.5 }}>Añade ramas en el panel…</i>}
        {branches.map((b) => (
          <div key={b.id} style={{ position: "relative", height: rowH, display: "flex", alignItems: "center" }}>
            <span style={branchText}>{branchTitle(b)}</span>
            <Handle type="source" position={Position.Right} id={b.id} style={{ ...handleStyle, top: rowH / 2 }} />
            <AddNextButton sourceId={id} sourceHandle={b.id} placement="right" />
          </div>
        ))}
        <div style={{ position: "relative", height: rowH, display: "flex", alignItems: "center" }}>
          <span style={{ ...branchText, color: "#8aa0bd" }}>en otro caso</span>
          <Handle
            type="source"
            position={Position.Right}
            id="else"
            style={{ ...handleStyle, background: "#5a6b85", top: rowH / 2 }}
          />
          <AddNextButton sourceId={id} sourceHandle="else" placement="right" />
        </div>
      </div>
    </Shell>
  );
}

export function ActionNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const label = d.action ? (ACTION_LABEL[d.action] ?? d.action) : "Sin acción";
  return (
    <Shell id={id} type="action" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="action" />
      <div style={body}>
        {label}
        {(d.action === "tag" || d.action === "untag") && d.tag ? ` · ${d.tag}` : ""}
        {d.action === "create_deal" && d.dealTitle ? ` · ${d.dealTitle}` : ""}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} />
    </Shell>
  );
}

export function DelayNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const unit = d.delayUnit === "hours" ? "h" : "min";
  return (
    <Shell id={id} type="delay" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="delay" />
      <div style={body}>{d.delayValue ? `${d.delayValue} ${unit}` : <i style={placeholder}>Sin tiempo…</i>}</div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} />
    </Shell>
  );
}

export function HttpNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <Shell id={id} type="http" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="http" />
      <div style={body}>
        <strong>{d.method ?? "POST"}</strong>{" "}
        {d.url ? <Clamp>{d.url}</Clamp> : <i style={placeholder}>Sin URL…</i>}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} />
    </Shell>
  );
}

export function AssignNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <Shell id={id} type="assign" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="assign" />
      <div style={body}>{d.agentName || <i style={placeholder}>Elige un agente…</i>}</div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} />
    </Shell>
  );
}

export function JumpToFlowNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <Shell id={id} type="jumpToFlow" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="jumpToFlow" />
      <div style={body}>{d.flowName || <i style={placeholder}>Elige un flujo…</i>}</div>
    </Shell>
  );
}

/** Filas con una salida a la derecha cada una (botones, dividir, horario). */
function OutputRows({ id, rows, muted }: { id: string; rows: { id: string; label: string; color?: string }[]; muted?: string }) {
  const updateInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateInternals(id);
  }, [rows.length, id, updateInternals]);
  const rowH = 28;
  return (
    <div style={{ padding: "4px 10px 8px" }}>
      {rows.map((r) => (
        <div key={r.id} style={{ position: "relative", height: rowH, display: "flex", alignItems: "center" }}>
          <span style={{ ...branchText, color: r.color }}>{r.label}</span>
          <Handle type="source" position={Position.Right} id={r.id} style={{ ...handleStyle, background: r.color ?? "var(--accent)", top: rowH / 2 }} />
          <AddNextButton sourceId={id} sourceHandle={r.id} placement="right" />
        </div>
      ))}
      {muted && <i style={{ ...placeholder, fontSize: 11.5 }}>{muted}</i>}
    </div>
  );
}

export function ButtonsNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const buttons = d.buttons ?? [];
  return (
    <Shell id={id} type="buttons" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="buttons" />
      <div style={{ ...body, paddingBottom: 2 }}>{d.text ? <Clamp>{d.text}</Clamp> : <i style={placeholder}>Sin texto…</i>}</div>
      <OutputRows
        id={id}
        rows={[
          ...buttons.map((b, i) => ({ id: b.id, label: `▢ ${b.title || `Botón ${i + 1}`}` })),
          { id: "else", label: "otra respuesta", color: "#8aa0bd" },
        ]}
      />
    </Shell>
  );
}

export function SetFieldNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <Shell id={id} type="setField" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="setField" />
      <div style={body}>
        {d.fieldKey ? (
          <>
            <span style={{ color: "#8fd6e6" }}>{d.fieldKey === "name" ? "Nombre" : d.fieldKey}</span> ={" "}
            {d.value || <i style={placeholder}>vacío</i>}
          </>
        ) : (
          <i style={placeholder}>Elige un campo…</i>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} />
    </Shell>
  );
}

export function AddNoteNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <Shell id={id} type="addNote" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="addNote" />
      <div style={body}>{d.text ? <Clamp>{d.text}</Clamp> : <i style={placeholder}>Sin texto…</i>}</div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} />
    </Shell>
  );
}

export function SetStatusNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <Shell id={id} type="setStatus" selected={selected} minWidth={160}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="setStatus" />
      <div style={body}>{d.status ? STATUS_LABEL[d.status] : <i style={placeholder}>Elige un estado…</i>}</div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} />
    </Shell>
  );
}

export function SplitNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const splits = d.splits ?? [];
  return (
    <Shell id={id} type="split" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="split" />
      <OutputRows id={id} rows={splits.map((s) => ({ id: s.id, label: `${s.label || s.id} · ${s.weight}%` }))} muted={splits.length ? undefined : "Añade variantes en el panel…"} />
    </Shell>
  );
}

export function ScheduleNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const open = d.hours ? Object.values(d.hours.days ?? {}).filter(Boolean).length : 0;
  return (
    <Shell id={id} type="schedule" selected={selected}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head type="schedule" />
      <div style={{ ...body, paddingBottom: 2, fontSize: 11.5 }}>
        {d.hours ? `${open} día${open === 1 ? "" : "s"} · ${d.hours.timezone}` : <i style={placeholder}>Sin horario…</i>}
      </div>
      <OutputRows
        id={id}
        rows={[
          { id: "in", label: "en horario", color: "#7ee2a8" },
          { id: "out", label: "fuera de horario", color: "#e0b766" },
        ]}
      />
    </Shell>
  );
}

export const nodeTypes = {
  start: StartNode,
  buttons: ButtonsNode,
  setField: SetFieldNode,
  addNote: AddNoteNode,
  setStatus: SetStatusNode,
  split: SplitNode,
  schedule: ScheduleNode,
  sendMessage: SendMessageNode,
  sendTemplate: SendTemplateNode,
  askQuestion: AskQuestionNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  http: HttpNode,
  assign: AssignNode,
  jumpToFlow: JumpToFlowNode,
};

// ── Estilos ───────────────────────────────────────────────────

const handleStyle: React.CSSProperties = { width: 14, height: 14, background: "var(--accent)", border: "2px solid var(--panel-2)" };
const targetStyle: React.CSSProperties = { width: 14, height: 14, background: "#5a6b85", border: "2px solid var(--panel-2)" };

function shell(selected: boolean, color: string, minWidth = 190): React.CSSProperties {
  return {
    position: "relative",
    minWidth,
    maxWidth: 250,
    borderRadius: 10,
    border: `1.5px solid ${selected ? "var(--accent)" : color}`,
    background: "var(--panel-2)",
    color: "#e6edf6",
    fontSize: 12,
    boxShadow: selected ? "0 0 0 3px rgba(138,43,226,0.28), 0 8px 24px rgba(0,0,0,0.35)" : "0 2px 10px rgba(0,0,0,0.25)",
    transition: "box-shadow 0.12s ease, border-color 0.12s ease",
  };
}

const head: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "7px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  fontWeight: 700,
  fontSize: 12,
};

const body: React.CSSProperties = {
  padding: "8px 10px",
  color: "#aebfd6",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  lineHeight: 1.45,
};

const branchText: React.CSSProperties = {
  fontSize: 11,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  paddingRight: 10,
};

const plusBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
  zIndex: 20,
  padding: 0,
};

const toolbar: React.CSSProperties = {
  display: "flex",
  gap: 4,
  padding: 4,
  borderRadius: 8,
  background: "var(--field)",
  border: "1px solid var(--border-strong)",
  boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
};

const toolBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 8px",
  borderRadius: 6,
  border: "none",
  background: "transparent",
  color: "#e6edf6",
  fontSize: 12,
  cursor: "pointer",
};

const issueDot: React.CSSProperties = {
  position: "absolute",
  top: -8,
  right: -8,
  width: 18,
  height: 18,
  borderRadius: "50%",
  background: "#b8562e",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid var(--panel-2)",
  zIndex: 5,
  cursor: "help",
};
