"use client";

import { NavIcon } from "./NavIcons";
import { useRealtimeCtx } from "./RealtimeProvider";
import { useT } from "@/i18n/I18nProvider";

/**
 * Campana de la cabecera: sonido de los avisos encendido o apagado, y la
 * primera vez que se enciende pide permiso de notificaciones al navegador.
 */
export function AlertsBell() {
  const t = useT();
  const { soundEnabled, permission, setSound, requestPermission } = useRealtimeCtx();
  const title = soundEnabled
    ? permission === "denied"
      ? t("inbox.notifyBlocked")
      : t("inbox.notifyOn")
    : t("inbox.notifyEnable");
  return (
    <button
      type="button"
      className="icon-btn"
      title={title}
      aria-pressed={soundEnabled}
      onClick={() => {
        if (soundEnabled) return setSound(false);
        setSound(true);
        void requestPermission();
      }}
      style={{ position: "relative", color: soundEnabled ? "var(--text)" : "var(--muted)" }}
    >
      <NavIcon name={soundEnabled ? "bell" : "bell-off"} />
      {soundEnabled && permission === "default" && (
        <span
          aria-hidden
          title={t("inbox.notifyEnable")}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--warning)",
          }}
        />
      )}
    </button>
  );
}
