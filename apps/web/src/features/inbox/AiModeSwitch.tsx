"use client";

import { AiMode } from "@crm/shared";
import { NavIcon } from "@/components/NavIcons";
import { useT } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";

/**
 * Control segmentado del modo de IA.
 *
 * Antes era un `<select>` idéntico al de "asignar a", lo que escondía el
 * interruptor más importante de la pantalla entre dos desplegables. Aquí los
 * tres estados están a la vista y a un clic, y el activo se marca con el
 * acento de marca — el acento señala, no decora.
 */

const MODES: { value: AiMode; labelKey: MessageKey; hintKey: MessageKey }[] = [
  { value: AiMode.OFF, labelKey: "inbox.aiOff", hintKey: "inbox.aiOffHint" },
  {
    value: AiMode.COPILOT,
    labelKey: "inbox.aiCopilot",
    hintKey: "inbox.aiCopilotHint",
  },
  {
    value: AiMode.AUTOPILOT,
    labelKey: "inbox.aiAutopilot",
    hintKey: "inbox.aiAutopilotHint",
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
  const t = useT();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={group} role="group" aria-label={t("inbox.aiModeLabel")}>
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
              title={t(m.hintKey)}
              aria-pressed={active}
              style={segment(active, m.value === AiMode.AUTOPILOT)}
            >
              {t(m.labelKey)}
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
          title={t("inbox.aiPausedHint")}
          style={pausedChip}
        >
          <NavIcon name="pause" size={12} />
          {t("inbox.aiPausedChip")}
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
  background: "var(--field)",
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
    // Solo autopilot se lleva el acento lleno: es el estado "la IA está al
    // mando", el único que merece la señal. Copilot es un tinte.
    background: active
      ? isAutopilot
        ? "var(--accent)"
        : "var(--accent-soft)"
      : "transparent",
    color: active
      ? isAutopilot
        ? "var(--accent-ink)"
        : "var(--text)"
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
  border: "1px solid var(--border)",
  background: "var(--warning-soft)",
  color: "var(--warning)",
  fontSize: 11.5,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
