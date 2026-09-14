"use client";

import { useContext, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowBranch } from "@crm/shared";
import { NavIcon, type IconName } from "@/components/NavIcons";
import { FlowActionsContext, NODE_PALETTE } from "./flowShared";

const ACTION_LABEL: Record<string, string> = {
  ai: "Pasar a bot IA",
  handoff: "Pasar a humano",
  tag: "Poner etiqueta",
  move_deal: "Mover en pipeline",
};

// Cabecera de nodo con icono de línea (línea gráfica unificada).
function Head({
  icon,
  color,
  children,
}: {
  icon: IconName;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...head, color, display: "flex", alignItems: "center", gap: 7 }}>
      <NavIcon name={icon} size={15} />
      {children}
    </div>
  );
}

// Botón "+" que crea un bloque nuevo conectado a esta salida y abre su panel.
function AddNextButton({
  sourceId,
  pos,
  sourceHandle,
  placement = "bottom",
}: {
  sourceId: string;
  pos: { x: number; y: number };
  sourceHandle?: string;
  placement?: "bottom" | "right";
}) {
  const actions = useContext(FlowActionsContext);
  const [open, setOpen] = useState(false);
  // Una salida solo puede enlazar un bloque: si ya tiene arista, no hay "+".
  if (!actions || actions.isOutgoingTaken(sourceId, sourceHandle)) return null;
  const addNext = actions.addNext;

  const anchor: React.CSSProperties =
    placement === "right"
      ? { position: "absolute", right: -22, top: "50%", transform: "translateY(-50%)" }
      : { position: "absolute", bottom: -24, left: "50%", transform: "translateX(-50%)" };

  return (
    <div className="nodrag nopan" style={{ ...anchor, zIndex: 20 }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={plusBtn}
        title="Añadir siguiente bloque"
      >
        +
      </button>
      {open && (
        <>
          <div style={addBackdrop} onClick={() => setOpen(false)} />
          <div style={addMenu} onClick={(e) => e.stopPropagation()}>
            {NODE_PALETTE.map((p) => (
              <button
                key={p.type}
                style={addMenuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  addNext({ sourceId, sourceHandle, pos, type: p.type });
                  setOpen(false);
                }}
              >
                <NavIcon name={p.icon} size={14} />
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const handleStyle = { width: 9, height: 9, background: "#3578ff", border: "none" };
const targetStyle = { width: 9, height: 9, background: "#5a6b85", border: "none" };

function shell(selected: boolean, color: string): React.CSSProperties {
  return {
    position: "relative",
    minWidth: 180,
    maxWidth: 240,
    borderRadius: 10,
    border: `1.5px solid ${selected ? "#3578ff" : color}`,
    background: "#0f1726",
    color: "#e6edf6",
    fontSize: 12,
    boxShadow: selected ? "0 0 0 2px rgba(53,120,255,0.3)" : "none",
  };
}

const head: React.CSSProperties = {
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
};

function nodePos(p: NodeProps): { x: number; y: number } {
  return { x: p.positionAbsoluteX, y: p.positionAbsoluteY };
}

export function StartNode(props: NodeProps) {
  const { id, selected } = props;
  return (
    <div style={{ ...shell(!!selected, "#1f6f46"), minWidth: 120 }}>
      <div style={{ ...head, color: "#7ee2a8", borderBottom: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <NavIcon name="play" size={14} />
        Inicio
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} pos={nodePos(props)} />
    </div>
  );
}

export function SendMessageNode(props: NodeProps) {
  const { id, data, selected } = props;
  const text = (data as { text?: string }).text;
  return (
    <div style={shell(!!selected, "#2c4b7a")}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head icon="message" color="#9ec1ff">Enviar mensaje</Head>
      <div style={body}>{text || <i style={{ opacity: 0.5 }}>Sin texto…</i>}</div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} pos={nodePos(props)} />
    </div>
  );
}

export function AskQuestionNode(props: NodeProps) {
  const { id, data, selected } = props;
  const d = data as { text?: string; variable?: string };
  return (
    <div style={shell(!!selected, "#7a5fb0")}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head icon="question" color="#cbb6ff">Preguntar y guardar</Head>
      <div style={body}>
        {d.text || <i style={{ opacity: 0.5 }}>Sin pregunta…</i>}
        {d.variable && (
          <div style={{ marginTop: 4, color: "#7ee2a8" }}>→ {`{{${d.variable}}}`}</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} pos={nodePos(props)} />
    </div>
  );
}

export function ConditionNode(props: NodeProps) {
  const { id, data, selected } = props;
  const branches = ((data as { branches?: FlowBranch[] }).branches ?? []) as FlowBranch[];
  const rowH = 26;
  const pos = nodePos(props);
  return (
    <div style={shell(!!selected, "#b08a3f")}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head icon="branch" color="#ffd98a">Condición</Head>
      <div style={{ padding: "6px 10px" }}>
        {branches.length === 0 && (
          <i style={{ opacity: 0.5 }}>Añade ramas en el panel…</i>
        )}
        {branches.map((b) => (
          <div
            key={b.id}
            style={{ position: "relative", height: rowH, display: "flex", alignItems: "center" }}
          >
            <span style={{ fontSize: 11 }}>{b.label || b.keywords.join(", ") || "rama"}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={b.id}
              style={{ ...handleStyle, top: rowH / 2 }}
            />
            <AddNextButton sourceId={id} pos={pos} sourceHandle={b.id} placement="right" />
          </div>
        ))}
        <div style={{ position: "relative", height: rowH, display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#8aa0bd" }}>en otro caso</span>
          <Handle
            type="source"
            position={Position.Right}
            id="else"
            style={{ ...handleStyle, background: "#5a6b85", top: rowH / 2 }}
          />
          <AddNextButton sourceId={id} pos={pos} sourceHandle="else" placement="right" />
        </div>
      </div>
    </div>
  );
}

export function ActionNode(props: NodeProps) {
  const { id, data, selected } = props;
  const d = data as { action?: string; tag?: string };
  const label = d.action ? ACTION_LABEL[d.action] ?? d.action : "Sin acción";
  return (
    <div style={shell(!!selected, "#3f8c6e")}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head icon="bolt" color="#8fe6c0">Acción</Head>
      <div style={body}>
        {label}
        {d.action === "tag" && d.tag ? ` · ${d.tag}` : ""}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} pos={nodePos(props)} />
    </div>
  );
}

export function DelayNode(props: NodeProps) {
  const { id, data, selected } = props;
  const d = data as { delayValue?: number; delayUnit?: string };
  const unit = d.delayUnit === "hours" ? "h" : "min";
  return (
    <div style={shell(!!selected, "#7a6f4a")}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head icon="clock" color="#e8d79a">Esperar</Head>
      <div style={body}>
        {d.delayValue ? `${d.delayValue} ${unit}` : <i style={{ opacity: 0.5 }}>Sin tiempo…</i>}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} pos={nodePos(props)} />
    </div>
  );
}

export function HttpNode(props: NodeProps) {
  const { id, data, selected } = props;
  const d = data as { method?: string; url?: string };
  return (
    <div style={shell(!!selected, "#4a6f7a")}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head icon="globe" color="#9ad8e8">Petición HTTP</Head>
      <div style={body}>
        <strong>{d.method ?? "POST"}</strong> {d.url || <i style={{ opacity: 0.5 }}>Sin URL…</i>}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} pos={nodePos(props)} />
    </div>
  );
}

export function AssignNode(props: NodeProps) {
  const { id, data, selected } = props;
  const d = data as { agentName?: string };
  return (
    <div style={shell(!!selected, "#6a4a7a")}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head icon="user" color="#d6b6e8">Asignar a agente</Head>
      <div style={body}>{d.agentName || <i style={{ opacity: 0.5 }}>Elige un agente…</i>}</div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <AddNextButton sourceId={id} pos={nodePos(props)} />
    </div>
  );
}

export function JumpToFlowNode({ data, selected }: NodeProps) {
  const d = data as { flowName?: string };
  return (
    <div style={shell(!!selected, "#3f8c6e")}>
      <Handle type="target" position={Position.Top} style={targetStyle} />
      <Head icon="jump" color="#8fe6c0">Ir a otro flujo</Head>
      <div style={body}>{d.flowName || <i style={{ opacity: 0.5 }}>Elige un flujo…</i>}</div>
    </div>
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
};

const addBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10,
};

const addMenu: React.CSSProperties = {
  position: "absolute",
  top: 26,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 30,
  background: "#0d1320",
  border: "1px solid #233047",
  borderRadius: 10,
  padding: 4,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  width: 190,
  boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
};

const addMenuItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 9px",
  borderRadius: 7,
  border: "none",
  background: "transparent",
  color: "#e6edf6",
  fontSize: 12.5,
  cursor: "pointer",
  textAlign: "left",
};
