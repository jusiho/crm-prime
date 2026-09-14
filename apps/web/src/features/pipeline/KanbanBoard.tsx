"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { confirmDialog } from "@/lib/confirm";
import type { DealDto, PipelineDto, StageDto } from "@crm/shared";
import {
  createDeal,
  createStage,
  deleteDeal,
  deleteStage,
  fetchAgents,
  fetchContacts,
  fetchCustomFields,
  fetchPipeline,
  moveDeal,
  reorderStages,
  updateContact,
  updateDeal,
  updateStage,
} from "@/lib/bff";
import { useRealtime } from "@/hooks/useRealtime";

function money(value: number | null, currency: string): string {
  if (value === null) return "";
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency }).format(
      value,
    );
  } catch {
    return `${value} ${currency}`;
  }
}

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const { connected } = useRealtime({
    "pipeline.changed": () =>
      queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
  });

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["pipeline"],
    queryFn: fetchPipeline,
  });

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [showStages, setShowStages] = useState(false);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });

  const move = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
      moveDeal(dealId, stageId),
    // Actualización optimista: mover la tarjeta de inmediato.
    onMutate: async ({ dealId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: ["pipeline"] });
      const prev = queryClient.getQueryData<PipelineDto>(["pipeline"]);
      if (prev) {
        queryClient.setQueryData<PipelineDto>(["pipeline"], {
          ...prev,
          deals: prev.deals.map((d) =>
            d.id === dealId ? { ...d, stageId } : d,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["pipeline"], ctx.prev);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
  });

  const dealsByStage = useMemo(() => {
    const map = new Map<string, DealDto[]>();
    for (const d of data?.deals ?? []) {
      const list = map.get(d.stageId) ?? [];
      list.push(d);
      map.set(d.stageId, list);
    }
    return map;
  }, [data]);

  if (isPending) return <PipelineSkeleton />;
  if (isError)
    return (
      <PipelineError message={(error as Error).message} onRetry={() => refetch()} />
    );
  if (!data) return <PipelineSkeleton />;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Pipeline</h2>
        <span
          title={connected ? "En tiempo real" : "Desconectado"}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: connected ? "var(--accent)" : "#7a8aa0",
          }}
        />
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowStages(true)} style={ghostBtn}>
          ⚙ Etapas
        </button>
        <NewDealForm onCreated={invalidate} />
      </div>

      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12 }}>
        {data.stages.map((stage) => {
          const deals = dealsByStage.get(stage.id) ?? [];
          const total = deals.reduce((s, d) => s + (d.value ?? 0), 0);
          const cur = deals.find((d) => d.value !== null)?.currency ?? "USD";
          return (
            <div
              key={stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dealId = e.dataTransfer.getData("text/plain");
                const deal = data.deals.find((d) => d.id === dealId);
                if (dealId && deal && deal.stageId !== stage.id) {
                  move.mutate({ dealId, stageId: stage.id });
                }
              }}
              style={column}
            >
              <div style={columnHeader}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {stage.isWon && "🏆 "}
                  {stage.isLost && "✕ "}
                  {stage.name}
                </span>
                <span style={{ color: "var(--muted)" }}>{deals.length}</span>
              </div>
              {total > 0 && (
                <div style={{ color: "#7ee2a8", fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
                  {money(total, cur)}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {deals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", deal.id)
                    }
                    onClick={() => setSelectedDealId(deal.id)}
                    style={card}
                  >
                    <strong style={{ fontSize: 14 }}>{deal.title}</strong>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                      {deal.contact.name ?? deal.contact.phone}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      {deal.value !== null ? (
                        <span style={{ color: "var(--accent)", fontSize: 13 }}>
                          {money(deal.value, deal.currency)}
                        </span>
                      ) : <span />}
                      {deal.owner && (
                        <span style={ownerAvatar} title={deal.owner.name ?? "Vendedor"}>
                          {(deal.owner.name ?? "?")[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {(() => {
        const d = selectedDealId
          ? data.deals.find((x) => x.id === selectedDealId)
          : null;
        return d ? (
          <DealDetail
            key={d.id}
            deal={d}
            stages={data.stages}
            onClose={() => setSelectedDealId(null)}
            onChanged={invalidate}
            onDeleted={() => {
              setSelectedDealId(null);
              invalidate();
            }}
          />
        ) : null;
      })()}

      {showStages && (
        <StageManager
          stages={data.stages}
          onClose={() => setShowStages(false)}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}

function DealDetail({
  deal,
  stages,
  onClose,
  onChanged,
  onDeleted,
}: {
  deal: DealDto;
  stages: StageDto[];
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });
  const { data: customFields = [] } = useQuery({
    queryKey: ["custom-fields"],
    queryFn: fetchCustomFields,
  });
  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState(deal.value != null ? String(deal.value) : "");
  const [fields, setFields] = useState<Record<string, string>>(deal.contact.fields ?? {});

  const saveFields = useMutation({
    mutationFn: () => updateContact(deal.contact.id, { fields }),
    onSuccess: onChanged,
  });

  const save = useMutation({
    mutationFn: () =>
      updateDeal(deal.id, {
        title: title.trim(),
        value: value ? Number(value) : null,
      }),
    onSuccess: onChanged,
  });
  const setOwner = useMutation({
    mutationFn: (ownerId: string | null) => updateDeal(deal.id, { ownerId }),
    onSuccess: onChanged,
  });
  const setStage = useMutation({
    mutationFn: (stageId: string) => moveDeal(deal.id, stageId),
    onSuccess: onChanged,
  });
  const remove = useMutation({ mutationFn: () => deleteDeal(deal.id), onSuccess: onDeleted });

  const won = stages.find((s) => s.isWon);
  const lost = stages.find((s) => s.isLost);

  return (
    <>
      <div style={backdrop} onClick={onClose} />
      <aside style={drawer}>
        <header style={drawerHeader}>
          <strong>Oportunidad</strong>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          <Field label="Título">
            <input style={field} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => save.mutate()} />
          </Field>
          <Field label="Contacto">
            <div style={{ color: "var(--muted)", fontSize: 14 }}>
              {deal.contact.name ?? deal.contact.phone}
            </div>
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Valor" style={{ flex: 1 }}>
              <input style={field} type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => save.mutate()} />
            </Field>
            <Field label="Etapa" style={{ flex: 1 }}>
              <select style={field} value={deal.stageId} onChange={(e) => setStage.mutate(e.target.value)}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Vendedor (owner)">
            <select
              style={field}
              value={deal.owner?.id ?? ""}
              onChange={(e) => setOwner.mutate(e.target.value || null)}
            >
              <option value="">— Sin asignar —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name ?? a.email}</option>
              ))}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            {won && (
              <button onClick={() => setStage.mutate(won.id)} style={{ ...primaryBtn, flex: 1, background: "#1f6f46", color: "#eaf2ff" }}>
                🏆 Ganado
              </button>
            )}
            {lost && (
              <button onClick={() => setStage.mutate(lost.id)} style={{ ...ghostBtn, flex: 1, borderColor: "#5a2a2a", color: "#e08a8a" }}>
                ✕ Perdido
              </button>
            )}
          </div>
          {customFields.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                Campos del lead
              </span>
              {customFields.map((f) => (
                <Field key={f.id} label={f.label}>
                  {f.type === "select" ? (
                    <select
                      style={field}
                      value={fields[f.key] ?? ""}
                      onChange={(e) => setFields((v) => ({ ...v, [f.key]: e.target.value }))}
                    >
                      <option value="">—</option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      style={field}
                      value={fields[f.key] ?? ""}
                      onChange={(e) => setFields((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  )}
                </Field>
              ))}
              <button onClick={() => saveFields.mutate()} disabled={saveFields.isPending} style={primaryBtn}>
                {saveFields.isPending ? "Guardando…" : "Guardar campos"}
              </button>
            </div>
          )}

          <button
            onClick={() => {
              void confirmDialog({
                message: "¿Eliminar esta oportunidad?",
                danger: true,
              }).then((ok) => ok && remove.mutate());
            }}
            style={{ ...ghostBtn, color: "#e08a8a", borderColor: "#5a2a2a" }}
          >
            Eliminar oportunidad
          </button>
        </div>
      </aside>
    </>
  );
}

function StageManager({
  stages,
  onClose,
  onChanged,
}: {
  stages: StageDto[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => createStage({ name: name.trim(), isWon: false, isLost: false }),
    onSuccess: () => { setName(""); onChanged(); },
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateStage(id, { name }),
    onSuccess: onChanged,
  });
  const remove = useMutation({ mutationFn: deleteStage, onSuccess: onChanged });
  const reorder = useMutation({ mutationFn: reorderStages, onSuccess: onChanged });

  function moveStage(i: number, dir: -1 | 1) {
    const ids = stages.map((s) => s.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate(ids);
  }

  return (
    <>
      <div style={backdrop} onClick={onClose} />
      <aside style={drawer}>
        <header style={drawerHeader}>
          <strong>Etapas del pipeline</strong>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
          {stages.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                style={{ ...field, flex: 1 }}
                defaultValue={s.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== s.name)
                    rename.mutate({ id: s.id, name: e.target.value.trim() });
                }}
              />
              <button onClick={() => moveStage(i, -1)} disabled={i === 0} style={miniBtn}>↑</button>
              <button onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1} style={miniBtn}>↓</button>
              <button
                onClick={() => {
                  void confirmDialog({
                    message: `¿Eliminar la etapa "${s.name}"?`,
                    danger: true,
                  }).then((ok) => ok && remove.mutate(s.id));
                }}
                style={{ ...miniBtn, color: "#e08a8a" }}
              >✕</button>
            </div>
          ))}
          {remove.isError && (
            <span style={{ color: "#ff6b6b", fontSize: 13 }}>{(remove.error as Error).message}</span>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input style={{ ...field, flex: 1 }} value={name} placeholder="Nueva etapa" onChange={(e) => setName(e.target.value)} />
            <button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending} style={primaryBtn}>
              Añadir
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, ...style }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      {children}
    </label>
  );
}

function PipelineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      <h2 style={{ margin: 0 }}>Pipeline</h2>
      <div
        style={{
          padding: "12px 16px",
          borderRadius: 10,
          background: "#2a2113",
          border: "1px solid #5a4a2a",
          color: "#e0b766",
          fontSize: 14,
        }}
      >
        No se pudo cargar el tablero: {message}
      </div>
      <button onClick={onRetry} style={primaryBtn}>
        Reintentar
      </button>
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Pipeline</h2>
        <div className="spinner" aria-label="Cargando" />
        <span style={{ color: "var(--muted)", fontSize: 14 }}>Cargando tablero…</span>
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "hidden" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={column}>
            <div
              className="skeleton"
              style={{ height: 16, width: "55%", marginBottom: 12 }}
            />
            {Array.from({ length: (i % 3) + 1 }).map((__, j) => (
              <div
                key={j}
                className="skeleton"
                style={{ height: 62, marginBottom: 8, opacity: 0.85 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewDealForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => fetchContacts(),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      createDeal({
        contactId,
        title: title.trim(),
        value: value ? Number(value) : undefined,
        currency: "USD",
      }),
    onSuccess: () => {
      setOpen(false);
      setTitle("");
      setValue("");
      setContactId("");
      onCreated();
    },
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={primaryBtn}>
        + Nuevo deal
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (contactId && title.trim()) create.mutate();
      }}
      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
    >
      <select
        value={contactId}
        onChange={(e) => setContactId(e.target.value)}
        required
        style={field}
      >
        <option value="">Contacto…</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name ?? c.phone}
          </option>
        ))}
      </select>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        required
        style={field}
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Valor"
        type="number"
        min="0"
        style={{ ...field, width: 90 }}
      />
      <button type="submit" disabled={create.isPending} style={primaryBtn}>
        Crear
      </button>
      <button type="button" onClick={() => setOpen(false)} style={ghostBtn}>
        Cancelar
      </button>
      {contacts.length === 0 && (
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          (sin contactos: recibe un mensaje primero)
        </span>
      )}
    </form>
  );
}

const column: React.CSSProperties = {
  width: 260,
  flexShrink: 0,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 12,
  minHeight: 200,
};

const columnHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontWeight: 600,
  fontSize: 14,
  marginBottom: 10,
};

const card: React.CSSProperties = {
  background: "#1c2738",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "10px 12px",
  cursor: "grab",
  boxShadow: "var(--shadow-card)",
};

const field: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
};

const ownerAvatar: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  background: "#22304a",
  color: "#cfe0ff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 700,
  flexShrink: 0,
};

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  zIndex: 40,
};

const drawer: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  height: "100vh",
  width: 380,
  maxWidth: "92vw",
  background: "var(--bg)",
  borderLeft: "1px solid var(--border)",
  zIndex: 41,
  display: "flex",
  flexDirection: "column",
  boxShadow: "-8px 0 24px rgba(0,0,0,0.4)",
};

const drawerHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 16,
  borderBottom: "1px solid var(--border)",
  fontSize: 16,
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  fontSize: 18,
  cursor: "pointer",
};

const miniBtn: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: 13,
};
