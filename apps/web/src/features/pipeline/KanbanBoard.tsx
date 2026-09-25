"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { confirmDialog } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import { NavIcon } from "@/components/NavIcons";
import type { DealDto, PipelineDto, PipelineSummaryDto, PipelineView, StageDto } from "@crm/shared";
import {
  createDeal,
  createStage,
  deleteDeal,
  deleteStage,
  discardDeal,
  fetchAgents,
  fetchContacts,
  fetchCustomFields,
  fetchPipeline,
  moveDeal,
  reorderStages,
  restoreDeal,
  updateContact,
  updateDeal,
  updateStage,
} from "@/lib/bff";
import { useRealtime } from "@/hooks/useRealtime";
import { dangerBtn, ghostBtn, primaryBtn, smBtn } from "@/components/ui";

function money(value: number | null, currency: string): string {
  if (value === null) return "";
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [view, setView] = useState<PipelineView>("open");
  // Clave con el embudo y la vista: cambiar de embudo es otra consulta, y
  // `["pipeline"]` como prefijo invalida todas a la vez.
  const qk = ["pipeline", pipelineId ?? "default", view] as const;

  const { connected } = useRealtime({
    "pipeline.changed": () => queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
  });

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: qk,
    queryFn: () => fetchPipeline(pipelineId ?? undefined, view),
  });

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [showStages, setShowStages] = useState(false);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["pipeline"] });

  const move = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
      moveDeal(dealId, stageId),
    // Actualización optimista: mover la tarjeta de inmediato.
    onMutate: async ({ dealId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: qk });
      const prev = queryClient.getQueryData<PipelineDto>(qk);
      if (prev) {
        queryClient.setQueryData<PipelineDto>(qk, {
          ...prev,
          deals: prev.deals.map((d) => (d.id === dealId ? { ...d, stageId } : d)),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(qk, ctx.prev);
    },
    onSettled: invalidate,
  });

  const discard = useMutation({
    mutationFn: (dealId: string) => discardDeal(dealId, "manual"),
    onSuccess: () => {
      invalidate();
      setSelectedDealId(null);
      toast.success("Oportunidad descartada. Volverá sola si el contacto escribe.");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const restore = useMutation({
    mutationFn: restoreDeal,
    onSuccess: () => {
      invalidate();
      toast.success("Oportunidad restaurada");
    },
    onError: (e) => toast.error((e as Error).message),
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
  if (isError) return <PipelineError message={(error as Error).message} onRetry={() => refetch()} />;
  if (!data) return <PipelineSkeleton />;

  const current = data.pipelines.find((p) => p.id === data.pipelineId);
  // Etapa de entrada: sus tarjetas llevan el atajo "Descartar".
  const entryStageId = current?.inboundEnabled
    ? (current.inboundStageId ?? data.stages[0]?.id ?? null)
    : null;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Embudo</h2>
        <span
          title={connected ? "En tiempo real" : "Desconectado"}
          style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "var(--accent)" : "#7a8aa0" }}
        />
        {data.pipelines.length > 1 ? (
          <div className="seg" role="tablist" aria-label="Embudos">
            {data.pipelines.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={p.id === data.pipelineId}
                onClick={() => {
                  setPipelineId(p.id);
                  setView("open");
                  setSelectedDealId(null);
                }}
              >
                {p.name}
                <span style={{ marginLeft: 6, color: "var(--muted)", fontWeight: 500 }}>{p.openDeals}</span>
              </button>
            ))}
          </div>
        ) : (
          <span style={{ color: "var(--muted)", fontSize: 14 }}>{current?.name}</span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setView((v) => (v === "open" ? "discarded" : "open"))}
          style={{ ...ghostBtn, ...smBtn, color: view === "discarded" ? "var(--text)" : "var(--muted)" }}
          title="Oportunidades que no eran venta o que nadie atendió a tiempo"
        >
          {view === "open" ? `Descartadas (${data.discardedCount})` : "Volver al tablero"}
        </button>
        <button onClick={() => setShowStages(true)} style={{ ...ghostBtn, ...smBtn }}>
          <NavIcon name="settings" size={14} />
          Etapas
        </button>
        <NewDealForm pipelineId={data.pipelineId} onCreated={invalidate} />
      </div>

      {view === "discarded" ? (
        <DiscardedList
          deals={data.deals}
          pipeline={current}
          onRestore={(id) => restore.mutate(id)}
          onOpen={setSelectedDealId}
        />
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12 }}>
          {data.stages.map((stage) => {
            const deals = dealsByStage.get(stage.id) ?? [];
            const total = deals.reduce((s, d) => s + (d.value ?? 0), 0);
            const cur = deals.find((d) => d.value !== null)?.currency ?? "USD";
            const isEntry = stage.id === entryStageId;
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
                    {stage.isWon && <NavIcon name="trophy" size={14} />}
                    {stage.isLost && <NavIcon name="x" size={14} />}
                    {isEntry && (
                      <span title="Etapa de entrada: aquí aparecen las conversaciones nuevas de WhatsApp" style={{ color: "#9ec1ff", display: "inline-flex" }}>
                        <NavIcon name="inbox" size={14} />
                      </span>
                    )}
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
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      entry={isEntry}
                      onOpen={() => setSelectedDealId(deal.id)}
                      onDiscard={() => discard.mutate(deal.id)}
                    />
                  ))}
                  {isEntry && deals.length === 0 && (
                    <div style={emptyEntry}>
                      Las conversaciones nuevas de WhatsApp aparecerán aquí.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(() => {
        const d = selectedDealId ? data.deals.find((x) => x.id === selectedDealId) : null;
        return d ? (
          <DealDetail
            key={d.id}
            deal={d}
            stages={data.stages}
            onClose={() => setSelectedDealId(null)}
            onChanged={invalidate}
            onDiscard={() => discard.mutate(d.id)}
            onRestore={() => {
              restore.mutate(d.id);
              setSelectedDealId(null);
            }}
            onDeleted={() => {
              setSelectedDealId(null);
              invalidate();
            }}
          />
        ) : null;
      })()}

      {showStages && (
        <StageManager
          pipelineId={data.pipelineId}
          stages={data.stages}
          onClose={() => setShowStages(false)}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}

function DealCard({
  deal,
  entry,
  onOpen,
  onDiscard,
}: {
  deal: DealDto;
  entry: boolean;
  onOpen: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", deal.id)}
      onClick={onOpen}
      style={card}
    >
      <strong style={{ fontSize: 14 }}>{deal.title}</strong>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
        {deal.contact.name ?? deal.contact.phone}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {deal.source && (
            <span style={sourceChip} title={`Fuente: ${deal.source.name}`}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: deal.source.color ?? "#7a8aa0", flexShrink: 0 }} />
              {deal.source.name}
            </span>
          )}
          {deal.value !== null && (
            <span style={{ color: "var(--accent)", fontSize: 13 }}>{money(deal.value, deal.currency)}</span>
          )}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {entry && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDiscard();
              }}
              style={discardMini}
              title="No es una venta: descartar (vuelve sola si el contacto escribe)"
            >
              Descartar
            </button>
          )}
          {deal.owner && (
            <span style={ownerAvatar} title={deal.owner.name ?? "Vendedor"}>
              {(deal.owner.name ?? "?")[0]?.toUpperCase()}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function DiscardedList({
  deals,
  pipeline,
  onRestore,
  onOpen,
}: {
  deals: DealDto[];
  pipeline: PipelineSummaryDto | undefined;
  onRestore: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const motivo = (d: DealDto) =>
    d.discardReason === "auto"
      ? `Sin respuesta en ${pipeline?.inboundDiscardDays ?? "—"} días`
      : d.discardReason === "manual" || !d.discardReason
        ? "Descartada a mano"
        : d.discardReason;

  if (!deals.length) {
    return (
      <div style={{ ...column, width: "100%", maxWidth: 640, color: "var(--muted)", fontSize: 14 }}>
        No hay oportunidades descartadas en este embudo.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 820 }}>
      {deals.map((d) => (
        <div key={d.id} style={{ ...card, cursor: "default", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>{d.title}</strong>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
              {d.contact.name ?? d.contact.phone}
              {d.source ? ` · ${d.source.name}` : ""}
              {d.discardedAt ? ` · ${fecha(d.discardedAt)}` : ""}
            </div>
          </div>
          <span style={{ fontSize: 12, color: "#e0b766", whiteSpace: "nowrap" }}>{motivo(d)}</span>
          <button onClick={() => onOpen(d.id)} style={{ ...ghostBtn, ...smBtn }}>
            Ver
          </button>
          <button onClick={() => onRestore(d.id)} style={{ ...primaryBtn, ...smBtn }}>
            Restaurar
          </button>
        </div>
      ))}
    </div>
  );
}

function DealDetail({
  deal,
  stages,
  onClose,
  onChanged,
  onDiscard,
  onRestore,
  onDeleted,
}: {
  deal: DealDto;
  stages: StageDto[];
  onClose: () => void;
  onChanged: () => void;
  onDiscard: () => void;
  onRestore: () => void;
  onDeleted: () => void;
}) {
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const { data: customFields = [] } = useQuery({ queryKey: ["custom-fields"], queryFn: fetchCustomFields });
  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState(deal.value != null ? String(deal.value) : "");
  const [fields, setFields] = useState<Record<string, string>>(deal.contact.fields ?? {});

  const saveFields = useMutation({
    mutationFn: () => updateContact(deal.contact.id, { fields }),
    onSuccess: onChanged,
  });
  const save = useMutation({
    mutationFn: () => updateDeal(deal.id, { title: title.trim(), value: value ? Number(value) : null }),
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
  const discarded = !!deal.discardedAt;

  return (
    <>
      <div style={backdrop} onClick={onClose} />
      <aside style={drawer}>
        <header style={drawerHeader}>
          <strong>Oportunidad</strong>
          <button onClick={onClose} style={closeBtn} title="Cerrar">
            <NavIcon name="x" size={16} />
          </button>
        </header>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          {discarded && (
            <div style={discardedNote}>
              Descartada
              {deal.discardReason === "auto" ? " por falta de respuesta" : ""}
              {deal.discardedAt ? ` el ${fecha(deal.discardedAt)}` : ""}.
              <button onClick={onRestore} style={{ ...primaryBtn, ...smBtn, marginLeft: 10 }}>
                Restaurar
              </button>
            </div>
          )}
          <Field label="Título">
            <input style={field} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => save.mutate()} />
          </Field>
          <Field label="Contacto">
            <div style={{ color: "var(--muted)", fontSize: 14 }}>
              {deal.contact.name ?? deal.contact.phone}
              {deal.source ? ` · ${deal.source.name}` : ""}
            </div>
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Valor" style={{ flex: 1 }}>
              <input style={field} type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => save.mutate()} />
            </Field>
            <Field label="Etapa" style={{ flex: 1 }}>
              <select style={field} value={deal.stageId} onChange={(e) => setStage.mutate(e.target.value)}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Vendedor (owner)">
            <select style={field} value={deal.owner?.id ?? ""} onChange={(e) => setOwner.mutate(e.target.value || null)}>
              <option value="">— Sin asignar —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.email}
                </option>
              ))}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            {won && (
              <button
                onClick={() => setStage.mutate(won.id)}
                style={{ ...primaryBtn, flex: 1, background: "#1f6f46", boxShadow: "none" }}
              >
                <NavIcon name="trophy" size={15} />
                Ganado
              </button>
            )}
            {lost && (
              <button onClick={() => setStage.mutate(lost.id)} style={{ ...dangerBtn, flex: 1 }}>
                <NavIcon name="x" size={15} />
                Perdido
              </button>
            )}
          </div>
          {!discarded && (
            <button
              onClick={() => {
                void confirmDialog({
                  title: "Descartar oportunidad",
                  message:
                    "No era una venta (soporte, spam, equivocación…). No se borra: queda en «Descartadas» y vuelve sola si el contacto escribe.",
                  confirmLabel: "Descartar",
                }).then((ok) => ok && onDiscard());
              }}
              style={ghostBtn}
            >
              Descartar: no es una venta
            </button>
          )}
          {customFields.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Campos del lead</span>
              {customFields.map((f) => (
                <Field key={f.id} label={f.label}>
                  {f.type === "select" ? (
                    <select style={field} value={fields[f.key] ?? ""} onChange={(e) => setFields((v) => ({ ...v, [f.key]: e.target.value }))}>
                      <option value="">—</option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
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
              void confirmDialog({ message: "¿Eliminar esta oportunidad definitivamente?", danger: true }).then(
                (ok) => ok && remove.mutate(),
              );
            }}
            style={dangerBtn}
          >
            Eliminar oportunidad
          </button>
        </div>
      </aside>
    </>
  );
}

function StageManager({
  pipelineId,
  stages,
  onClose,
  onChanged,
}: {
  pipelineId: string;
  stages: StageDto[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => createStage({ name: name.trim(), isWon: false, isLost: false, pipelineId }),
    onSuccess: () => {
      setName("");
      onChanged();
    },
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
          <strong>Etapas del embudo</strong>
          <button onClick={onClose} style={closeBtn} title="Cerrar">
            <NavIcon name="x" size={16} />
          </button>
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
              <button onClick={() => moveStage(i, -1)} disabled={i === 0} style={miniBtn} title="Subir">
                <NavIcon name="arrow-up" size={13} />
              </button>
              <button onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1} style={miniBtn} title="Bajar">
                <NavIcon name="arrow-down" size={13} />
              </button>
              <button
                onClick={() => {
                  void confirmDialog({ message: `¿Eliminar la etapa "${s.name}"?`, danger: true }).then(
                    (ok) => ok && remove.mutate(s.id),
                  );
                }}
                style={{ ...miniBtn, color: "#e08a8a" }}
                title="Eliminar etapa"
              >
                <NavIcon name="x" size={13} />
              </button>
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
          <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "6px 0 0" }}>
            Para crear otros embudos o configurar la entrada automática: Ajustes › Embudos y etapas.
          </p>
        </div>
      </aside>
    </>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, ...style }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      {children}
    </label>
  );
}

function PipelineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      <h2 style={{ margin: 0 }}>Embudo</h2>
      <div style={{ padding: "12px 16px", borderRadius: 10, background: "#2a2113", border: "1px solid #5a4a2a", color: "#e0b766", fontSize: 14 }}>
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
        <h2 style={{ margin: 0 }}>Embudo</h2>
        <div className="spinner" aria-label="Cargando" />
        <span style={{ color: "var(--muted)", fontSize: 14 }}>Cargando tablero…</span>
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "hidden" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={column}>
            <div className="skeleton" style={{ height: 16, width: "55%", marginBottom: 12 }} />
            {Array.from({ length: (i % 3) + 1 }).map((__, j) => (
              <div key={j} className="skeleton" style={{ height: 62, marginBottom: 8, opacity: 0.85 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewDealForm({ pipelineId, onCreated }: { pipelineId: string; onCreated: () => void }) {
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
        pipelineId,
      }),
    onSuccess: () => {
      setOpen(false);
      setTitle("");
      setValue("");
      setContactId("");
      onCreated();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={primaryBtn}>
        + Nueva oportunidad
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
      <select value={contactId} onChange={(e) => setContactId(e.target.value)} required style={field}>
        <option value="">Contacto…</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name ?? c.phone}
          </option>
        ))}
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" required style={field} />
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valor" type="number" min="0" style={{ ...field, width: 90 }} />
      <button type="submit" disabled={create.isPending} style={primaryBtn}>
        Crear
      </button>
      <button type="button" onClick={() => setOpen(false)} style={ghostBtn}>
        Cancelar
      </button>
      {contacts.length === 0 && (
        <span style={{ color: "var(--muted)", fontSize: 12 }}>(sin contactos: recibe un mensaje primero)</span>
      )}
    </form>
  );
}

// ── Estilos ───────────────────────────────────────────────────

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

const emptyEntry: React.CSSProperties = {
  padding: "12px 10px",
  borderRadius: 8,
  border: "1px dashed var(--border)",
  color: "var(--muted)",
  fontSize: 12.5,
  textAlign: "center",
  lineHeight: 1.4,
};

const sourceChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
  color: "var(--muted)",
  maxWidth: 120,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const discardMini: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  fontSize: 11.5,
  cursor: "pointer",
  padding: "2px 4px",
  borderRadius: 5,
};

const discardedNote: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #7a6f4a",
  background: "rgba(224,183,102,0.08)",
  color: "#e0b766",
  fontSize: 13,
};

const field: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
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
