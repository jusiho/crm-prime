import type { CSSProperties } from "react";

export const box: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
  boxShadow: "var(--shadow-card)",
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

export const input: CSSProperties = {
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

export const toggle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  fontSize: 14,
  cursor: "pointer",
};

export const primaryBtn: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  fontWeight: 600,
  cursor: "pointer",
};

export const ghostBtn: CSSProperties = {
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
};
