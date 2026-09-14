// Familia de iconos de línea unificada (estilo lucide: trazo 1.75, 24×24,
// esquinas/uniones redondeadas). Se usa en el nav lateral y en los flujos
// para mantener una sola línea gráfica en toda la app.

export type IconName =
  // Navegación
  | "inbox"
  | "pipeline"
  | "bot"
  | "flow"
  | "megaphone"
  | "book"
  | "whatsapp"
  | "logout"
  // Bloques de flujo
  | "message"
  | "question"
  | "branch"
  | "bolt"
  | "clock"
  | "globe"
  | "user"
  | "jump"
  | "play"
  | "tag"
  | "settings"
  // Bandeja / conversación
  | "check"
  | "check-double"
  | "paperclip"
  | "sparkles"
  | "send"
  | "pause"
  | "image"
  | "file"
  | "search"
  | "arrow-down"
  | "reply"
  | "zap"
  | "x"
  | "alert"
  | "smile";

export function NavIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "inbox":
      return (
        <svg {...p}>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" />
        </svg>
      );
    case "pipeline":
      return (
        <svg {...p}>
          <rect x="3" y="4" width="5" height="16" rx="1.5" />
          <rect x="9.5" y="4" width="5" height="10" rx="1.5" />
          <rect x="16" y="4" width="5" height="13" rx="1.5" />
        </svg>
      );
    case "bot":
      return (
        <svg {...p}>
          <rect x="4" y="8" width="16" height="11" rx="3" />
          <path d="M12 8V5" />
          <circle cx="12" cy="3.6" r="1.1" />
          <path d="M2 14h1.5M20.5 14H22M9 13v1.5M15 13v1.5" />
        </svg>
      );
    case "flow":
      return (
        <svg {...p}>
          <rect x="3.5" y="3.5" width="6" height="5" rx="1.5" />
          <rect x="14.5" y="15.5" width="6" height="5" rx="1.5" />
          <path d="M6.5 8.5v4a2 2 0 0 0 2 2h9" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...p}>
          <path d="m3 11 16-5v12L3 14z" />
          <path d="M6 14v3a2 2 0 0 0 4 0" />
          <path d="M19 9a3 3 0 0 1 0 6" />
        </svg>
      );
    case "book":
      return (
        <svg {...p}>
          <path d="M12 7v14" />
          <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...p}>
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2.5 21.5z" />
          <path d="M9.3 9.2c-.2 0-.4.1-.6.3-.3.3-.6.7-.6 1.4 0 .8.6 1.6.7 1.7.1.2 1.1 1.9 2.8 2.6 1.4.6 1.7.5 2 .4.3 0 .9-.4 1-.7.2-.4.2-.7.1-.8l-.6-.3c-.3-.1-.6-.3-.8-.3-.2 0-.3-.1-.5.1l-.4.5c-.1.1-.2.1-.4 0-.2-.1-.7-.3-1.3-.8-.5-.4-.8-1-.9-1.1-.1-.2 0-.3.1-.4l.3-.4c.1-.1.1-.2.2-.4 0-.1 0-.3 0-.4l-.5-1.1c-.1-.3-.2-.3-.4-.3z" />
        </svg>
      );
    case "logout":
      return (
        <svg {...p}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5M21 12H9" />
        </svg>
      );
    case "message":
      return (
        <svg {...p}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "question":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9.2a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "branch":
      return (
        <svg {...p}>
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...p}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      );
    case "clock":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "globe":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
        </svg>
      );
    case "user":
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case "jump":
      return (
        <svg {...p}>
          <path d="M4 5v6a3 3 0 0 0 3 3h12" />
          <path d="m15 10 5 4-5 4" />
        </svg>
      );
    case "play":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8.5 16 12l-6 3.5z" />
        </svg>
      );
    case "tag":
      return (
        <svg {...p}>
          <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9z" />
          <circle cx="7.5" cy="7.5" r="1.3" />
        </svg>
      );
    // Un tick: enviado. Dos: entregado (y en azul, leído).
    case "check":
      return (
        <svg {...p}>
          <path d="M4 12.5 9 17.5 20 6.5" />
        </svg>
      );
    case "check-double":
      return (
        <svg {...p}>
          <path d="M2 12.5 6.5 17 15.5 8" />
          <path d="M9 15.2 11 17.2 21 7" />
        </svg>
      );
    case "paperclip":
      return (
        <svg {...p}>
          <path d="M20.4 11.5 12 19.9a5 5 0 0 1-7.1-7.1l8.5-8.4a3.3 3.3 0 1 1 4.7 4.7l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4l7.8-7.7" />
        </svg>
      );
    // Chispa: la IA. Sustituye al emoji ✨.
    case "sparkles":
      return (
        <svg {...p}>
          <path d="M12 3.5 13.6 8 18 9.6 13.6 11.2 12 15.7 10.4 11.2 6 9.6 10.4 8z" />
          <path d="M18.5 15.5l.7 1.9 1.8.7-1.8.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" />
        </svg>
      );
    case "send":
      return (
        <svg {...p}>
          <path d="M21.5 2.5 10.8 13.2" />
          <path d="M21.5 2.5 14.7 21.5l-3.9-8.3-8.3-3.9z" />
        </svg>
      );
    case "pause":
      return (
        <svg {...p}>
          <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
          <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
        </svg>
      );
    case "image":
      return (
        <svg {...p}>
          <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
          <circle cx="8.6" cy="10" r="1.6" />
          <path d="M3.5 17.5 9 12.4l4 3.6 3-2.4 4.5 3.9" />
        </svg>
      );
    case "file":
      return (
        <svg {...p}>
          <path d="M14 2.8v4.4a1.5 1.5 0 0 0 1.5 1.5h4.4" />
          <path d="M19.9 8.7V19a2.5 2.5 0 0 1-2.5 2.5H6.6A2.5 2.5 0 0 1 4.1 19V5A2.5 2.5 0 0 1 6.6 2.5h7.2z" />
        </svg>
      );
    case "search":
      return (
        <svg {...p}>
          <circle cx="10.8" cy="10.8" r="7" />
          <path d="M15.9 15.9 21 21" />
        </svg>
      );
    case "arrow-down":
      return (
        <svg {...p}>
          <path d="M12 4.5v15" />
          <path d="M5.8 13.2 12 19.5l6.2-6.3" />
        </svg>
      );
    case "reply":
      return (
        <svg {...p}>
          <path d="M9 5.5 3 11l6 5.5" />
          <path d="M3.4 11h9.1a8 8 0 0 1 8 8v0.5" />
        </svg>
      );
    case "zap":
      return (
        <svg {...p}>
          <path d="M13.2 2.5 4.5 13.4h6.2l-.9 8.1 8.7-10.9h-6.2z" />
        </svg>
      );
    case "smile":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9.2" />
          <path d="M8.2 14.2a4.6 4.6 0 0 0 7.6 0" />
          <circle cx="9.1" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="14.9" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "x":
      return (
        <svg {...p}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "alert":
      return (
        <svg {...p}>
          <path d="M12 8.5v5" />
          <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
          <path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
  }
}
