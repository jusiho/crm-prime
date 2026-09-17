"use client";

import { useState } from "react";
import { NavIcon } from "@/components/NavIcons";
import { mediaSrc } from "@/lib/bff";
import { useT } from "@/i18n/I18nProvider";

/**
 * Pinta el medio de un mensaje. Las imágenes se muestran en línea y se
 * amplían al hacer clic; los documentos, como una fila descargable.
 *
 * El binario no se sirve como estático público: va por el BFF, que añade el
 * JWT de la sesión, así que un enlace suelto no expone el archivo.
 */
export function MediaBubble({
  mediaUrl,
  type,
  caption,
}: {
  mediaUrl: string;
  type: string;
  caption: string | null;
}) {
  const t = useT();
  const src = mediaSrc(mediaUrl);
  const [zoom, setZoom] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src) {
    return (
      <div style={fallback}>
        {t("inbox.mediaUnavailable", { type: type.toLowerCase() })}
      </div>
    );
  }

  if (type !== "IMAGE") {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" style={docRow}>
        <NavIcon name="file" size={19} />
        <span style={{ textDecoration: "underline" }}>
          {caption || t("inbox.openDocument")}
        </span>
      </a>
    );
  }

  if (failed) {
    return (
      <div style={fallback}>
        {t("inbox.mediaUnavailable", { type: t("inbox.imageAlt") })}
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={caption ?? t("inbox.imageAlt")}
        onClick={() => setZoom(true)}
        onError={() => setFailed(true)}
        style={thumb}
      />
      {zoom && (
        <div style={overlay} onClick={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={caption ?? t("inbox.imageAlt")} style={full} />
        </div>
      )}
    </>
  );
}

const thumb: React.CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: 280,
  borderRadius: 8,
  cursor: "zoom-in",
  marginBottom: 4,
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  cursor: "zoom-out",
  padding: 24,
};

const full: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: "100%",
  borderRadius: 8,
};

const docRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--text)",
  fontSize: 13,
  marginBottom: 4,
};

const fallback: React.CSSProperties = {
  opacity: 0.6,
  fontSize: 13,
  fontStyle: "italic",
};
