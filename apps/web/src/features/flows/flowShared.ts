import { createContext } from "react";
import type { FlowNodeData, FlowNodeType } from "@crm/shared";
import type { IconName } from "@/components/NavIcons";

export interface NodeMeta {
  type: FlowNodeType;
  label: string;
  icon: IconName;
  /** Una línea para el menú de añadir. */
  hint: string;
  /** Borde del bloque. */
  color: string;
  /** Icono y título del bloque. */
  accent: string;
}

// Catálogo de bloques que se pueden añadir (paleta, menú "+" y arrastre).
export const NODE_PALETTE: NodeMeta[] = [
  { type: "sendMessage", label: "Enviar mensaje", icon: "message", hint: "Un texto al contacto", color: "#2c4b7a", accent: "#9ec1ff" },
  { type: "askQuestion", label: "Preguntar y guardar", icon: "question", hint: "Espera la respuesta y la guarda en una variable", color: "#7a5fb0", accent: "#cbb6ff" },
  { type: "condition", label: "Condición", icon: "branch", hint: "Ramifica según palabras clave", color: "#b08a3f", accent: "#ffd98a" },
  { type: "action", label: "Acción", icon: "bolt", hint: "IA, humano, etiqueta o pipeline", color: "#3f8c6e", accent: "#8fe6c0" },
  { type: "delay", label: "Esperar", icon: "clock", hint: "Pausa antes de seguir", color: "#7a6f4a", accent: "#e8d79a" },
  { type: "http", label: "Petición HTTP", icon: "globe", hint: "Llama a una API o a n8n", color: "#4a6f7a", accent: "#9ad8e8" },
  { type: "assign", label: "Asignar a agente", icon: "user", hint: "Reparte la conversación", color: "#6a4a7a", accent: "#d6b6e8" },
  { type: "jumpToFlow", label: "Ir a otro flujo", icon: "jump", hint: "Continúa en otro flujo", color: "#3f8c6e", accent: "#8fe6c0" },
];

// Metadatos por tipo, incluido el inicio (que no está en la paleta).
export const NODE_META: Record<string, NodeMeta> = Object.fromEntries([
  ["start", { type: "start", label: "Inicio", icon: "play", hint: "Donde arranca el flujo", color: "#1f6f46", accent: "#7ee2a8" }],
  ...NODE_PALETTE.map((m) => [m.type, m]),
]) as Record<string, NodeMeta>;

export function defaultNodeData(type: FlowNodeType): FlowNodeData {
  switch (type) {
    case "sendMessage":
      return { text: "" };
    case "askQuestion":
      return { text: "", variable: "" };
    case "condition":
      return { branches: [] };
    case "action":
      return { action: "ai", botId: null };
    case "delay":
      return { delayValue: 5, delayUnit: "minutes" };
    case "http":
      return { method: "POST", url: "" };
    case "assign":
      return { agentId: null };
    default:
      return {};
  }
}

/** Tipo MIME del arrastre desde la paleta al lienzo. */
export const DRAG_MIME = "application/x-trimmo-flow-node";

/** Bloques con una salida "por defecto" (sin handle): todos menos la condición y el salto. */
export function hasDefaultOutput(type: string | undefined): boolean {
  return type !== "condition" && type !== "jumpToFlow";
}

/** Petición de añadir un bloque: tras una salida, o en medio de una conexión. */
export interface AddRequest {
  sourceId: string;
  sourceHandle?: string | null;
  /** Conexión que se parte: el bloque nuevo queda entre `sourceId` y este nodo. */
  insertBefore?: string;
  /** Punto de pantalla donde anclar el menú. */
  anchor: { x: number; y: number };
}

// Lo que los bloques y las conexiones pueden pedirle al constructor.
export interface FlowActions {
  openAddMenu: (req: AddRequest) => void;
  /** Si esa salida (nodo + handle) ya tiene una conexión. */
  isOutgoingTaken: (sourceId: string, sourceHandle?: string | null) => boolean;
  removeEdge: (edgeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  issuesFor: (nodeId: string) => string[];
}

export const FlowActionsContext = createContext<FlowActions | null>(null);

// Clave única de una salida (nodo + handle). Handle vacío = salida por defecto.
export function outgoingKey(sourceId: string, sourceHandle?: string | null): string {
  return `${sourceId}::${sourceHandle ?? ""}`;
}
