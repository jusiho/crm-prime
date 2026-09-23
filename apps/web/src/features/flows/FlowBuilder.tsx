"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  flowTriggerTypes,
  type CreateFlowInput,
  type FlowAgentRef,
  type FlowBotRef,
  type FlowChannelRef,
  type FlowEdge,
  type FlowNode,
  type FlowNodeData,
  type FlowNodeType,
  type FlowSummary,
} from "@crm/shared";
import { createFlow, fetchFlow, updateFlow } from "@/lib/bff";
import { NavIcon } from "@/components/NavIcons";
import { nodeTypes } from "./FlowNodes";
import { NodeInspector } from "./NodeInspector";
import { FlowAssistant } from "./FlowAssistant";
import {
  FlowActionsContext,
  NODE_PALETTE,
  defaultNodeData,
  outgoingKey,
  type AddNextFn,
  type FlowActions,
} from "./flowShared";

export function FlowBuilder({
  flowId,
  channels,
  bots,
  stages,
  agents,
  flows,
  onBack,
}: {
  flowId: string | null; // null = nuevo
  channels: FlowChannelRef[];
  bots: FlowBotRef[];
  stages: { id: string; name: string }[];
  agents: FlowAgentRef[];
  flows: FlowSummary[];
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const isNew = !flowId;

  const { data: loaded } = useQuery({
    queryKey: ["flow", flowId],
    queryFn: () => fetchFlow(flowId!),
    enabled: !isNew,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [name, setName] = useState("Nuevo flujo");
  const [isActive, setIsActive] = useState(false);
  const [triggerType, setTriggerType] = useState<string>("conversation_start");
  const [triggerKeywords, setTriggerKeywords] = useState("");
  const [channelId, setChannelId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Snapshot previo a la última propuesta aplicada por el asistente.
  const [undoPoint, setUndoPoint] = useState<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);
  const idCounter = useRef(1);
  const initialized = useRef(false);

  // Inicializar el lienzo: cargar el flujo existente o sembrar un nodo "Inicio".
  useEffect(() => {
    if (initialized.current) return;
    if (isNew) {
      setNodes([
        { id: "start", type: "start", position: { x: 260, y: 40 }, data: {} },
      ]);
      initialized.current = true;
    } else if (loaded) {
      setName(loaded.name);
      setIsActive(loaded.isActive);
      setTriggerType(loaded.triggerType);
      setTriggerKeywords(loaded.triggerKeywords.join(", "));
      setChannelId(loaded.channelId);
      setNodes(loaded.nodes as unknown as Node[]);
      setEdges(loaded.edges as unknown as Edge[]);
      initialized.current = true;
    }
  }, [isNew, loaded, setNodes, setEdges]);

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds) => {
        // Una salida (source + handle) solo puede tener una arista: reemplaza.
        const filtered = eds.filter(
          (e) =>
            !(
              e.source === c.source &&
              (e.sourceHandle ?? null) === (c.sourceHandle ?? null)
            ),
        );
        return addEdge({ ...c, label: c.sourceHandle ?? undefined }, filtered);
      }),
    [setEdges],
  );

  function addNode(type: FlowNodeType) {
    const id = `n_${Date.now()}_${idCounter.current++}`;
    const node: Node = {
      id,
      type,
      position: { x: 120 + Math.random() * 120, y: 160 + Math.random() * 160 },
      data: defaultNodeData(type) as Record<string, unknown>,
    };
    setNodes((nds) => [...nds, node]);
    setSelectedId(id);
  }

  // "+" en un nodo: crea el bloque siguiente ya conectado y lo selecciona.
  const addNext = useCallback<AddNextFn>(
    ({ sourceId, sourceHandle, pos, type }) => {
      const id = `n_${Date.now()}_${idCounter.current++}`;
      const position = {
        x: pos.x + (sourceHandle ? 300 : 0),
        y: pos.y + 150,
      };
      setNodes((nds) => [
        ...nds,
        { id, type, position, data: defaultNodeData(type) as Record<string, unknown> },
      ]);
      setEdges((eds) =>
        addEdge(
          {
            id: `xy-${sourceId}-${id}`,
            source: sourceId,
            target: id,
            sourceHandle: sourceHandle ?? null,
            label: sourceHandle ?? undefined,
          },
          eds,
        ),
      );
      setSelectedId(id);
    },
    [setNodes, setEdges],
  );

  // El asistente devuelve el grafo completo: se reemplaza el lienzo entero,
  // guardando antes un punto de retorno para poder deshacer.
  function applyAssistantProposal(
    nextNodes: FlowNode[],
    nextEdges: FlowEdge[],
  ) {
    setUndoPoint({ nodes, edges });
    setNodes(nextNodes as unknown as Node[]);
    setEdges(nextEdges as unknown as Edge[]);
    setSelectedId(null);
  }

  function undoAssistant() {
    if (!undoPoint) return;
    setNodes(undoPoint.nodes);
    setEdges(undoPoint.edges);
    setUndoPoint(null);
    setSelectedId(null);
  }

  function updateNodeData(data: FlowNodeData) {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedId ? { ...n, data: data as Record<string, unknown> } : n,
      ),
    );
  }

  function deleteSelected() {
    if (!selectedId || selectedId === "start") return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedId && e.target !== selectedId),
    );
    setSelectedId(null);
  }

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  // El grafo en el formato compartido, que es lo que entiende el asistente.
  const graph = useMemo(
    () => ({
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type as FlowNode["type"],
        position: n.position,
        data: n.data as FlowNodeData,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        label: typeof e.label === "string" ? e.label : undefined,
      })) as FlowEdge[],
    }),
    [nodes, edges],
  );

  // Valor del contexto: addNext + qué salidas ya están enlazadas (reactivo a
  // las aristas, para que el "+" desaparezca al conectar y reaparezca al borrar).
  const flowActions = useMemo<FlowActions>(() => {
    const taken = new Set(
      edges.map((e) => outgoingKey(e.source, e.sourceHandle)),
    );
    return {
      addNext,
      isOutgoingTaken: (sourceId, sourceHandle) =>
        taken.has(outgoingKey(sourceId, sourceHandle)),
    };
  }, [edges, addNext]);

  const save = useMutation({
    mutationFn: () => {
      const payload: CreateFlowInput = {
        name,
        isActive,
        channelId,
        triggerType: triggerType as CreateFlowInput["triggerType"],
        triggerKeywords: triggerKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type as FlowNode["type"],
          position: n.position,
          data: n.data as FlowNodeData,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
          label: typeof e.label === "string" ? e.label : undefined,
        })) as FlowEdge[],
      };
      return isNew ? createFlow(payload) : updateFlow(flowId!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      onBack();
    },
  });

  return (
    <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
      {/* Barra superior */}
      <div style={bar}>
        <button
          onClick={onBack}
          style={{ ...ghost, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <NavIcon name="arrow-left" size={15} />
          Volver
        </button>
        <input
          style={{ ...input, width: 200, fontWeight: 600 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={miniLbl}>Disparador</span>
          <select
            style={{ ...input, width: 150 }}
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
          >
            {flowTriggerTypes.map((t) => (
              <option key={t} value={t}>
                {t === "conversation_start" ? "Al iniciar chat" : "Palabra clave"}
              </option>
            ))}
          </select>
        </div>
        {triggerType === "keyword" && (
          <input
            style={{ ...input, width: 180 }}
            value={triggerKeywords}
            placeholder="hola, info, precio"
            onChange={(e) => setTriggerKeywords(e.target.value)}
          />
        )}
        <select
          style={{ ...input, width: 160 }}
          value={channelId ?? ""}
          onChange={(e) => setChannelId(e.target.value || null)}
        >
          <option value="">Cualquier número</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label ?? c.displayPhoneNumber ?? c.id}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Activo
        </label>
        <div style={{ flex: 1 }} />
        {undoPoint && (
          <button
            onClick={undoAssistant}
            style={{ ...ghost, display: "inline-flex", alignItems: "center", gap: 6 }}
            title="Volver al flujo anterior"
          >
            <NavIcon name="reply" size={15} />
            Deshacer IA
          </button>
        )}
        <button
          onClick={() => setAssistantOpen((v) => !v)}
          style={assistantOpen ? assistantBtnOn : assistantBtnOff}
          title="Armar el flujo con IA"
        >
          <NavIcon name="bot" size={15} />
          Asistente
        </button>
        {save.isError && (
          <span style={{ color: "#ff6b6b", fontSize: 12 }}>
            {(save.error as Error).message}
          </span>
        )}
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          style={primary}
        >
          {save.isPending ? "Guardando…" : "Guardar flujo"}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Paleta */}
        <aside style={palette}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            Arrastra el lienzo, conecta los ● y añade bloques:
          </div>
          {NODE_PALETTE.map((p) => (
            <button key={p.type} onClick={() => addNode(p.type)} style={paletteBtn}>
              <NavIcon name={p.icon} size={16} />
              {p.label}
            </button>
          ))}
        </aside>

        {/* Lienzo */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <FlowActionsContext.Provider value={flowActions}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, n) => setSelectedId(n.id)}
              onPaneClick={() => setSelectedId(null)}
              nodeTypes={nodeTypes}
              fitView
              colorMode="dark"
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </FlowActionsContext.Provider>
        </div>

        {/* Inspector */}
        {selectedNode && (
          <aside style={inspector}>
            <NodeInspector
              node={selectedNode}
              bots={bots}
              stages={stages}
              agents={agents}
              flows={flows.filter((f) => f.id !== flowId)}
              onChange={updateNodeData}
              onDelete={deleteSelected}
            />
          </aside>
        )}

        {/* Asistente IA */}
        {assistantOpen && (
          <FlowAssistant
            flowId={flowId}
            nodes={graph.nodes}
            edges={graph.edges}
            onApply={applyAssistantProposal}
            onClose={() => setAssistantOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

const bar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 16px",
  borderBottom: "1px solid var(--border)",
  flexWrap: "wrap",
};

const palette: React.CSSProperties = {
  width: 210,
  flexShrink: 0,
  borderRight: "1px solid var(--border)",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const inspector: React.CSSProperties = {
  width: 300,
  flexShrink: 0,
  borderLeft: "1px solid var(--border)",
  padding: 16,
  overflowY: "auto",
};

const input: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 13,
  boxSizing: "border-box",
};

const miniLbl: React.CSSProperties = { fontSize: 12, color: "var(--muted)" };

const ghost: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 13,
};

const primary: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 7,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  fontWeight: 600,
  cursor: "pointer",
};

function assistantBtn(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "7px 12px",
    borderRadius: 7,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: active ? "rgba(53,120,255,0.12)" : "transparent",
    color: active ? "var(--accent)" : "var(--text)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  };
}
const assistantBtnOn = assistantBtn(true);
const assistantBtnOff = assistantBtn(false);

const paletteBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--panel)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: 13,
  textAlign: "left",
};
