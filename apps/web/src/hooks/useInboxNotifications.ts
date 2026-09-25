"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationDto } from "@crm/shared";

const PREF_KEY = "inbox.notify";

/**
 * Avisos de mensajes nuevos en la bandeja.
 *
 * No hace falta un evento de socket aparte: la lista ya se refresca en tiempo
 * real, así que basta comparar el contador de no leídos de cada conversación
 * con el de la pasada anterior. Cuando sube en un chat que no es el que está
 * abierto (o la pestaña está en segundo plano):
 *
 *   - suena un aviso corto (si el usuario lo activó);
 *   - se muestra una notificación del navegador (si dio permiso y la pestaña
 *     no está a la vista);
 *   - y el título de la pestaña lleva el total, "(3) Bandeja", siempre.
 */
export function useInboxNotifications(
  conversations: ConversationDto[],
  selectedId: string | null,
  nombreDe: (c: ConversationDto) => string,
  previewDe: (c: ConversationDto) => string,
) {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const seen = useRef<Map<string, number> | null>(null);
  const baseTitle = useRef<string>("");

  useEffect(() => {
    baseTitle.current = document.title;
    try {
      setEnabled(localStorage.getItem(PREF_KEY) === "1");
    } catch {
      /* sin almacenamiento: queda apagado */
    }
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    return () => {
      document.title = baseTitle.current;
    };
  }, []);

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

  // Título de la pestaña con el total.
  useEffect(() => {
    if (!baseTitle.current) return;
    document.title = totalUnread > 0 ? `(${totalUnread}) ${baseTitle.current}` : baseTitle.current;
  }, [totalUnread]);

  // Detectar subidas del contador por conversación.
  useEffect(() => {
    const now = new Map(conversations.map((c) => [c.id, c.unreadCount ?? 0]));
    const prev = seen.current;
    seen.current = now;
    if (!prev) return; // primera carga: nada que avisar

    const nuevos = conversations.filter((c) => (c.unreadCount ?? 0) > (prev.get(c.id) ?? 0));
    if (!nuevos.length) return;
    const relevantes = nuevos.filter((c) => c.id !== selectedId || document.hidden);
    if (!relevantes.length) return;

    if (enabled) beep();
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
      const c = relevantes[0]!;
      try {
        const n = new Notification(nombreDe(c), {
          body: relevantes.length > 1 ? `${previewDe(c)} (+${relevantes.length - 1})` : previewDe(c),
          tag: `trimmo-${c.id}`,
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        /* algunos navegadores lo bloquean fuera de un service worker */
      }
    }
  }, [conversations, selectedId, enabled, nombreDe, previewDe]);

  /** Activa sonido y pide permiso de notificaciones (desde un clic del usuario). */
  const enable = useCallback(async () => {
    try {
      localStorage.setItem(PREF_KEY, "1");
    } catch {
      /* sin almacenamiento */
    }
    setEnabled(true);
    beep(); // también sirve para desbloquear el audio tras el clic
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const p = await Notification.requestPermission();
      setPermission(p);
    }
  }, []);

  const disable = useCallback(() => {
    try {
      localStorage.setItem(PREF_KEY, "0");
    } catch {
      /* sin almacenamiento */
    }
    setEnabled(false);
  }, []);

  return { enabled, permission, totalUnread, enable, disable };
}

// Dos notas cortas con el AudioContext: sin archivo que cargar ni cachear.
let ctx: AudioContext | null = null;
function beep(): void {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t0 = ctx.currentTime;
    for (const [freq, at] of [
      [880, 0],
      [1175, 0.11],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.13);
    }
  } catch {
    /* sin audio */
  }
}
