"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { confirmDialog } from "@/lib/confirm";
import type { BotDto } from "@crm/shared";
import { deleteBot, fetchBots } from "@/lib/bff";
import { BotEditor } from "./BotEditor";
import { AgentPlayground } from "./AgentPlayground";
import { primaryBtn } from "./styles";

type Selection = { kind: "none" } | { kind: "new" } | { kind: "edit"; id: string };

export function BotsManager() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["bots"],
    queryFn: fetchBots,
  });
  const [sel, setSel] = useState<Selection>({ kind: "none" });
  const [testing, setTesting] = useState<{ id?: string; name?: string } | null>(
    null,
  );

  const remove = useMutation({
    mutationFn: deleteBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      setSel({ kind: "none" });
    },
  });

  const bots = data?.bots ?? [];
  const selectedBot =
    sel.kind === "edit" ? bots.find((b) => b.id === sel.id) ?? null : null;

  return (
    <div style={wrap}>
      {/* Lista */}
      <aside style={listCol}>
        <div style={listHeader}>
          <strong>Agentes</strong>
          <button onClick={() => setSel({ kind: "new" })} style={primaryBtn}>
            + Nuevo
          </button>
        </div>

        {isPending && <p style={muted}>Cargando…</p>}
        {isError && <p style={{ color: "#ff6b6b" }}>{(error as Error).message}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bots.map((b) => (
            <BotCard
              key={b.id}
              bot={b}
              active={sel.kind === "edit" && sel.id === b.id}
              onClick={() => setSel({ kind: "edit", id: b.id })}
            />
          ))}
          {!isPending && bots.length === 0 && (
            <p style={muted}>No hay agentes. Crea el primero con “+ Nuevo”.</p>
          )}
        </div>
      </aside>

      {/* Detalle */}
      <section style={detailCol}>
        {sel.kind === "none" && (
          <div style={empty}>
            <div style={{ fontSize: 38 }}>🤖</div>
            <p style={muted}>
              Selecciona un bot para editarlo o crea uno nuevo. Cada bot puede
              atender un número de WhatsApp distinto.
            </p>
            <button onClick={() => setTesting({})} style={testBtn}>
              🧪 Probar el bot por defecto
            </button>
          </div>
        )}

        {sel.kind === "new" && data && (
          <>
            <h2 style={detailTitle}>Nuevo agente</h2>
            <BotEditor
              bot={null}
              availableTools={data.availableTools}
              channels={data.channels}
              onSaved={(b) => setSel({ kind: "edit", id: b.id })}
              onCancel={() => setSel({ kind: "none" })}
            />
          </>
        )}

        {sel.kind === "edit" && selectedBot && data && (
          <>
            <div style={detailHead}>
              <h2 style={detailTitle}>{selectedBot.name}</h2>
              {selectedBot.isDefault && <span style={badge("#1f5a6f")}>por defecto</span>}
              <div style={{ flex: 1 }} />
              <button
                onClick={() =>
                  setTesting({ id: selectedBot.id, name: selectedBot.name })
                }
                style={testBtn}
              >
                🧪 Probar
              </button>
            </div>
            <BotEditor
              key={selectedBot.id}
              bot={selectedBot}
              availableTools={data.availableTools}
              channels={data.channels}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ["bots"] })}
              onCancel={() => setSel({ kind: "none" })}
              onDeleted={() => {
                void confirmDialog({
                  message: `¿Eliminar el agente "${selectedBot.name}"?`,
                  danger: true,
                }).then((ok) => ok && remove.mutate(selectedBot.id));
              }}
            />
          </>
        )}
      </section>

      {testing && (
        <AgentPlayground
          botId={testing.id}
          botName={testing.name}
          onClose={() => setTesting(null)}
        />
      )}
    </div>
  );
}

function BotCard({
  bot,
  active,
  onClick,
}: {
  bot: BotDto;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={card(active)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={dot(bot.isActive ? "#3578ff" : "#7a8aa0")} />
        <strong style={{ fontSize: 14 }}>{bot.name}</strong>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <span style={badge(bot.channel ? "#1f5a6f" : "#43506a")}>
          {bot.channel
            ? `📱 ${bot.channel.label ?? bot.channel.displayPhoneNumber}`
            : "global"}
        </span>
        {bot.autopilotByDefault && <span style={badge("#1f6f46")}>autopilot</span>}
        {bot.welcomeEnabled && <span style={badge("#3a4a6a")}>bienvenida</span>}
        {bot.businessHoursEnabled && <span style={badge("#3a4a6a")}>horario</span>}
        {bot.keywordTriggers.length > 0 && (
          <span style={badge("#3a4a6a")}>
            {bot.keywordTriggers.length} disparador
            {bot.keywordTriggers.length > 1 ? "es" : ""}
          </span>
        )}
      </div>
    </button>
  );
}

const wrap: React.CSSProperties = {
  display: "flex",
  gap: 18,
  padding: 20,
  maxWidth: 1100,
  margin: "0 auto",
  alignItems: "flex-start",
};

const listCol: React.CSSProperties = {
  width: 300,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  position: "sticky",
  top: 20,
};

const detailCol: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const listHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const detailHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
};

const detailTitle: React.CSSProperties = { margin: 0, fontSize: 20 };

const testBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #3a4a6a",
  background: "#16203a",
  color: "#a9c3ff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const empty: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  textAlign: "center",
  padding: "80px 24px",
  border: "1px dashed var(--border)",
  borderRadius: 12,
};

const muted: React.CSSProperties = { color: "var(--muted)", fontSize: 14 };

function card(active: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    padding: 12,
    borderRadius: 10,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: active ? "#10243a" : "var(--panel)",
    cursor: "pointer",
    color: "var(--text)",
  };
}

function dot(color: string): React.CSSProperties {
  return { width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 };
}

function badge(bg: string): React.CSSProperties {
  return {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: bg,
    color: "#e9f1ff",
  };
}
