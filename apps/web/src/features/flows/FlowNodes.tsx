"use client";

import { useContext, useEffect } from "react";
import {
  Handle,
  NodeToolbar,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import type { FlowBranch, FlowNodeData } from "@crm/shared";
import { NavIcon } from "@/components/NavIcons";
import { FlowActionsContext, NODE_META } from "./flowShared";

const ACTION_LABEL: Record<string, string> = {
  ai: "Pasar a agente IA",
  handoff: "Pasar a humano",
  tag: "Poner etiqueta",
  move_deal: "Mover en pipeline",
};

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
  return (
    <div style={shell(!!selected, meta?.color ?? "#3a4c6a", minWidth)}>
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
      <div style={body}>{d.text ? <Clamp>{d.text}</Clamp> : <i style={placeholder}>Sin texto…</i>}</div>
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
      </div>
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
            <span style={branchText}>{b.label || b.keywords.join(", ") || "rama"}</span>
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
        {d.action === "tag" && d.tag ? ` · ${d.tag}` : ""}
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

export const nodeTypes = {
  start: StartNode,
  sendMessage: SendMessageNode,
  askQuestion: AskQuestionNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  http: HttpNode,
  assign: AssignNode,
  jumpToFlow: JumpToFlowNode,
};

// ── Estilos ───────────────────────────────────────────────────

const handleStyle: React.CSSProperties = { width: 11, height: 11, background: "#3578ff", border: "2px solid #0f1726" };
const targetStyle: React.CSSProperties = { width: 11, height: 11, background: "#5a6b85", border: "2px solid #0f1726" };

function shell(selected: boolean, color: string, minWidth = 190): React.CSSProperties {
  return {
    position: "relative",
    minWidth,
    maxWidth: 250,
    borderRadius: 10,
    border: `1.5px solid ${selected ? "#3578ff" : color}`,
    background: "#0f1726",
    color: "#e6edf6",
    fontSize: 12,
    boxShadow: selected ? "0 0 0 3px rgba(53,120,255,0.28), 0 8px 24px rgba(0,0,0,0.35)" : "0 2px 10px rgba(0,0,0,0.25)",
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
  background: "#3578ff",
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
  background: "#0d1320",
  border: "1px solid #233047",
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
  border: "2px solid #0f1726",
  zIndex: 5,
  cursor: "help",
};
