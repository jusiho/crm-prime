import type { CSSProperties } from "react";
import { card, input as fieldInput, primaryBtn as btnPrimary, ghostBtn as btnGhost } from "@/components/ui";

// Los controles salen del módulo común (components/ui.ts) para que los
// botones y campos de los agentes sean los mismos que en el resto del CRM.
// Aquí solo queda lo que es propio de estas pantallas.

export const box: CSSProperties = {
  ...card,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

export const field: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

export const label: CSSProperties = {
  fontSize: 13,
  color: "var(--muted)",
};

export const input: CSSProperties = fieldInput;

export const toggle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  fontSize: 14,
  cursor: "pointer",
};

export const primaryBtn: CSSProperties = { ...btnPrimary, padding: "10px 18px" };

export const ghostBtn: CSSProperties = btnGhost;
