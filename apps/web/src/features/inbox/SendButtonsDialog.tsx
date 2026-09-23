"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendInteractive } from "@/lib/bff";
import { toast } from "@/lib/toast";
import { TemplatePreview } from "../campaigns/TemplatePreview";
import { dialogInput, dialogLabel, ghostBtn, primaryBtn } from "./dialogStyles";

/**
 * Mensaje con botones de respuesta rápida, sin plantilla. No necesita
 * aprobación de Meta, pero solo vale dentro de la ventana de 24h.
 */
export function SendButtonsDialog({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [titles, setTitles] = useState<string[]>([""]);

  const buttons = titles.map((t) => t.trim()).filter(Boolean);

  const send = useMutation({
    mutationFn: () =>
      sendInteractive({
        conversationId,
        body: body.trim(),
        header: header.trim() || undefined,
        footer: footer.trim() || undefined,
        buttons: buttons.map((title) => ({ title })),
      }),
    onSuccess: () => {
      toast.success("Mensaje enviado.");
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div
        className="confirm-dialog"
        style={{ width: 620, maxHeight: "86vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 4px" }}>Mensaje con botones</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          Hasta 3 botones de 20 caracteres. Cuando el cliente pulse uno, su
          respuesta entra como un mensaje normal en el chat.
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={dialogLabel}>Encabezado (opcional)</div>
              <input
                style={dialogInput}
                maxLength={60}
                value={header}
                onChange={(e) => setHeader(e.target.value)}
              />
            </div>
            <div>
              <div style={dialogLabel}>Mensaje</div>
              <textarea
                style={{ ...dialogInput, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
                maxLength={1024}
                value={body}
                placeholder="¿Confirmas tu pedido?"
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div>
              <div style={dialogLabel}>Pie (opcional)</div>
              <input
                style={dialogInput}
                maxLength={60}
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
              />
            </div>

            <div style={dialogLabel}>Botones</div>
            {titles.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <input
                  style={dialogInput}
                  maxLength={20}
                  value={t}
                  placeholder={`Botón ${i + 1}`}
                  onChange={(e) =>
                    setTitles((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                  }
                />
                {titles.length > 1 && (
                  <button
                    style={ghostBtn}
                    onClick={() => setTitles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
            {titles.length < 3 && (
              <button style={ghostBtn} onClick={() => setTitles((prev) => [...prev, ""])}>
                + Añadir botón
              </button>
            )}
          </div>

          <div style={{ flex: "0 1 250px" }}>
            <div style={dialogLabel}>Vista previa</div>
            <TemplatePreview
              header={header ? { format: "TEXT", text: header } : null}
              body={body}
              footer={footer}
              buttons={buttons.map((title) => ({ type: "QUICK_REPLY", text: title }))}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} style={ghostBtn}>
            Cancelar
          </button>
          <button
            onClick={() => send.mutate()}
            disabled={!body.trim() || buttons.length === 0 || send.isPending}
            style={primaryBtn}
          >
            {send.isPending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
