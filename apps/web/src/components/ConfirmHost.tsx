"use client";

import { useEffect, useState } from "react";
import {
  resolveConfirm,
  subscribeConfirm,
  type PendingConfirm,
} from "@/lib/confirm";

export function ConfirmHost() {
  const [c, setC] = useState<PendingConfirm | null>(null);
  useEffect(() => subscribeConfirm(setC), []);

  useEffect(() => {
    if (!c) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolveConfirm(false);
      if (e.key === "Enter") resolveConfirm(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c]);

  if (!c) return null;

  return (
    <div className="confirm-backdrop confirm-backdrop--top" onClick={() => resolveConfirm(false)}>
      <div
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        {c.title && <h3 className="confirm-title">{c.title}</h3>}
        <p className="confirm-msg">{c.message}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={() => resolveConfirm(false)}>
            {c.cancelLabel ?? "Cancelar"}
          </button>
          <button
            className={c.danger ? "confirm-ok confirm-danger" : "confirm-ok"}
            onClick={() => resolveConfirm(true)}
            autoFocus
          >
            {c.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
