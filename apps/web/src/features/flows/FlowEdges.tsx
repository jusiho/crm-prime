"use client";

import { useContext } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useNodesData,
  type EdgeProps,
} from "@xyflow/react";
import type { FlowBranch, FlowNodeData } from "@crm/shared";
import { FlowActionsContext } from "./flowShared";

/**
 * Conexión entre bloques. En su punto medio lleva la etiqueta de la rama (si
 * sale de una condición) y dos herramientas: "+" para insertar un bloque en
 * medio y "×" para quitarla. Se muestran al pasar por encima o al
 * seleccionarla (ver .flow-edge-tools en globals.css).
 */
export function FlowEdge(props: EdgeProps) {
  const {
    id,
    source,
    target,
    sourceHandleId,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    markerEnd,
  } = props;
  const actions = useContext(FlowActionsContext);
  const src = useNodesData(source);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 14,
  });

  // La etiqueta se lee del bloque origen en vivo: si renombras la rama en el
  // inspector, la conexión lo refleja al momento.
  let label: string | null = null;
  if (sourceHandleId) {
    const branches = ((src?.data as FlowNodeData | undefined)?.branches ?? []) as FlowBranch[];
    label =
      sourceHandleId === "else"
        ? "en otro caso"
        : branches.find((b) => b.id === sourceHandleId)?.label || "rama";
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke: selected ? "#6ba2ff" : "#3d5078", strokeWidth: selected ? 2.2 : 1.6 }}
      />
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan flow-edge-tools${selected ? " is-selected" : ""}`}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          {label && <span style={chip}>{label}</span>}
          <button
            style={btn}
            title="Insertar un bloque aquí"
            onClick={(e) => {
              e.stopPropagation();
              actions?.openAddMenu({
                sourceId: source,
                sourceHandle: sourceHandleId ?? null,
                insertBefore: target,
                anchor: { x: e.clientX, y: e.clientY },
              });
            }}
          >
            +
          </button>
          <button
            style={{ ...btn, color: "#e08a8a" }}
            title="Quitar la conexión"
            onClick={(e) => {
              e.stopPropagation();
              actions?.removeEdge(id);
            }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = { flow: FlowEdge };

const chip: React.CSSProperties = {
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#16213a",
  border: "1px solid #2b3d5c",
  color: "#cbd8ec",
  whiteSpace: "nowrap",
  maxWidth: 140,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const btn: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: "50%",
  border: "1px solid #2b3d5c",
  background: "#0d1320",
  color: "#9ec1ff",
  fontSize: 14,
  lineHeight: 1,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};
