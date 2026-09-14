"use client";

import { AiMode } from "@crm/shared";
import { NavIcon } from "@/components/NavIcons";

/**
 * Control segmentado del modo de IA.
 *
 * Antes era un `<select>` idéntico al de "asignar a", lo que escondía el
 * interruptor más importante de la pantalla entre dos desplegables. Aquí los
 * tres estados están a la vista y a un clic, y el activo se marca con el verde
 * de marca — el acento señala, no decora.
 */

const MODES: { value: AiMode; label: string; hint: string }[] = [
  { value: AiMode.OFF, label: "Off", hint: "La IA no interviene" },
  {
    value: AiMode.COPILOT,
    label: "Copilot",
    hint: "Sugiere y tú revisas antes de enviar",
  },
  {
    value: AiMode.AUTOPILOT,
    label: "Autopilot",
    hint: "Responde sola a cada mensaje entrante",
  },
];

export function AiModeSwitch({
  value,
  paused,
  disabled,
  onChange,
}: {
  value: AiMode;
  paused: boolean;
  disabled: boolean;
  onChange: (m: AiMode) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={group} role="group" aria-label="Modo del agente IA">
        <span style={groupIcon}>
          <NavIcon name="sparkles" size={14} />
        </span>
        {MODES.map((m) => {
          const active = value === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => !active && onChange(m.value)}
              disabled={disabled}
              title={m.hint}
              aria-pressed={active}
              style={segment(active, m.value === AiMode.AUTOPILOT)}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Cambiar el modo levanta la pausa, así que este aviso es accionable:
          dice por qué la IA calla y qué hacer. */}
      {paused && value !== AiMode.OFF && (
        <button
          type="button"
          onClick={() => onChange(value)}
          disabled={disabled}
          title="La IA se pausa 15 min cuando responde un humano. Pulsa para reanudarla ya."
          style={pausedChip}
        >
          <NavIcon name="pause" size={12} />
          En pausa · reanudar
        </button>
      )}
    </div>
  );
}

const group: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  padding: 3,
  borderRadius: 999,
  background: "var(--field, #0d1320)",
  border: "1px solid var(--border)",
};

const groupIcon: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0 4px 0 6px",
  color: "var(--muted)",
};

function segment(active: boolean, isAutopilot: boolean): React.CSSProperties {
  return {
    padding: "5px 12px",
    borderRadius: 999,
    border: "none",
    // Solo autopilot se lleva el verde lleno: es el estado "la IA está al
    // mando", el único que merece la señal. Copilot es un tinte.
    background: active
      ? isAutopilot
        ? "var(--accent, #25d366)"
        : "rgba(37,211,102,0.14)"
      : "transparent",
    color: active
      ? isAutopilot
        ? "var(--accent-ink, #04210f)"
        : "var(--positive, #7ee2a8)"
      : "var(--muted)",
    fontSize: 12.5,
    fontWeight: active ? 700 : 500,
    cursor: active ? "default" : "pointer",
    transition: "background 160ms cubic-bezier(0.22,1,0.36,1), color 160ms",
    whiteSpace: "nowrap",
  };
}

const pausedChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid #5a4a2a",
  background: "rgba(224,164,88,0.12)",
  color: "var(--warning, #e0a458)",
  fontSize: 11.5,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
