"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CustomFieldDto,
  CustomFieldType,
  SourceDto,
  StageDto,
} from "@crm/shared";
import {
  createCustomField,
  createSource,
  createStage,
  deleteCustomField,
  deleteSource,
  deleteStage,
  fetchCustomFields,
  fetchPipeline,
  fetchSources,
  reorderStages,
  updateSource,
} from "@/lib/bff";
import { confirmDialog } from "@/lib/confirm";
import { toast } from "@/lib/toast";

// ── Fuentes ──────────────────────────────────────────────────
export function SourcesSettings() {
  const queryClient = useQueryClient();
  const { data: sources = [], isPending } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["sources"] });
    queryClient.invalidateQueries({ queryKey: ["sellers"] });
  };

  const [name, setName] = useState("");
  const [color, setColor] = useState("#2c4b7a");

  const create = useMutation({
    mutationFn: () => createSource({ name: name.trim(), color }),
    onSuccess: () => {
      setName("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Panel
      title="Fuentes de leads"
      subtitle="El origen de tus contactos (Facebook Ads, Instagram, Web, Referido…). Cada fuente se asigna a los vendedores que la atienden."
    >
      <div style={{ ...card, display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={swatch} title="Color" />
        <input
          style={input}
          value={name}
          placeholder="Nueva fuente (ej. Facebook Ads)"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate()}
        />
        <button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending} style={primaryBtn}>
          Añadir
        </button>
      </div>
      {isPending && <p style={muted}>Cargando…</p>}
      {sources.map((s) => (
        <SourceRow key={s.id} source={s} onChanged={refresh} />
      ))}
    </Panel>
  );
}

function SourceRow({ source, onChanged }: { source: SourceDto; onChanged: () => void }) {
  const [name, setName] = useState(source.name);
  const [color, setColor] = useState(source.color ?? "#2c4b7a");
  const dirty = name.trim() !== source.name || color !== (source.color ?? "#2c4b7a");

  const save = useMutation({
    mutationFn: () => updateSource(source.id, { name: name.trim(), color }),
    onSuccess: () => {
      toast.success("Fuente actualizada");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: () => deleteSource(source.id),
    onSuccess: onChanged,
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div style={{ ...card, display: "flex", gap: 10, alignItems: "center" }}>
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={swatch} title="Color" />
      <input style={{ ...input, fontWeight: 600 }} value={name} onChange={(e) => setName(e.target.value)} />
      <span style={{ ...muted, fontSize: 12.5, whiteSpace: "nowrap" }}>
        {source.contactCount} contacto{source.contactCount === 1 ? "" : "s"}
      </span>
      {dirty && (
        <button onClick={() => save.mutate()} disabled={save.isPending} style={primaryBtn}>
          {save.isPending ? "…" : "Guardar"}
        </button>
      )}
      <button
        onClick={() => {
          void confirmDialog({ message: `¿Eliminar la fuente "${source.name}"?`, danger: true }).then(
            (ok) => ok && remove.mutate(),
          );
        }}
        style={dangerBtn}
        title="Eliminar"
      >
        ✕
      </button>
    </div>
  );
}

// ── Campos personalizados ────────────────────────────────────
const TYPE_LABEL: Record<CustomFieldType, string> = {
  text: "Texto",
  number: "Número",
  date: "Fecha",
  select: "Lista",
};

export function CustomFieldsSettings() {
  const queryClient = useQueryClient();
  const { data: fields = [], isPending } = useQuery({
    queryKey: ["custom-fields"],
    queryFn: fetchCustomFields,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["custom-fields"] });

  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createCustomField({
        label: label.trim(),
        type,
        options:
          type === "select"
            ? options.split(",").map((o) => o.trim()).filter(Boolean)
            : [],
      }),
    onSuccess: () => {
      setLabel("");
      setType("text");
      setOptions("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: deleteCustomField,
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  const canCreate =
    label.trim().length > 0 && (type !== "select" || options.trim().length > 0);

  return (
    <Panel
      title="Campos personalizados"
      subtitle="Datos extra que quieres guardar en cada contacto (cumpleaños, ciudad, talla…). Aparecen en la ficha del contacto."
    >
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={input}
            value={label}
            placeholder="Nombre del campo (ej. Ciudad)"
            onChange={(e) => setLabel(e.target.value)}
          />
          <select style={{ ...input, flex: "0 0 130px" }} value={type} onChange={(e) => setType(e.target.value as CustomFieldType)}>
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="date">Fecha</option>
            <option value="select">Lista</option>
          </select>
          <button onClick={() => create.mutate()} disabled={!canCreate || create.isPending} style={primaryBtn}>
            Añadir
          </button>
        </div>
        {type === "select" && (
          <input
            style={input}
            value={options}
            placeholder="Opciones separadas por coma (ej. Pequeña, Mediana, Grande)"
            onChange={(e) => setOptions(e.target.value)}
          />
        )}
      </div>
      {isPending && <p style={muted}>Cargando…</p>}
      {fields.map((f) => (
        <FieldRow key={f.id} field={f} onDelete={() => remove.mutate(f.id)} />
      ))}
    </Panel>
  );
}

function FieldRow({ field, onDelete }: { field: CustomFieldDto; onDelete: () => void }) {
  return (
    <div style={{ ...card, display: "flex", gap: 10, alignItems: "center" }}>
      <strong style={{ flex: 1, minWidth: 0 }}>{field.label}</strong>
      <span style={badge("#3a4a6a")}>{TYPE_LABEL[field.type]}</span>
      {field.type === "select" && field.options.length > 0 && (
        <span style={{ ...muted, fontSize: 12.5 }}>{field.options.join(" · ")}</span>
      )}
      <button
        onClick={() => {
          void confirmDialog({ message: `¿Eliminar el campo "${field.label}"?`, danger: true }).then(
            (ok) => ok && onDelete(),
          );
        }}
        style={dangerBtn}
        title="Eliminar"
      >
        ✕
      </button>
    </div>
  );
}

// ── Etapas del pipeline ──────────────────────────────────────
export function StagesSettings() {
  const queryClient = useQueryClient();
  const { data: pipeline, isPending } = useQuery({
    queryKey: ["pipeline"],
    queryFn: fetchPipeline,
  });
  const stages = pipeline?.stages ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["pipeline"] });

  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => createStage({ name: name.trim(), isWon: false, isLost: false }),
    onSuccess: () => {
      setName("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: deleteStage,
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });
  const reorder = useMutation({
    mutationFn: reorderStages,
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  const move = (index: number, dir: -1 | 1) => {
    const next = [...stages];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next.map((s) => s.id));
  };

  return (
    <Panel
      title="Etapas del pipeline"
      subtitle="Las columnas de tu embudo de ventas. Ordénalas según tu proceso; las marcadas como ganada/perdida cierran el deal."
    >
      <div style={{ ...card, display: "flex", gap: 8, alignItems: "center" }}>
        <input
          style={input}
          value={name}
          placeholder="Nueva etapa (ej. Negociación)"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate()}
        />
        <button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending} style={primaryBtn}>
          Añadir
        </button>
      </div>
      {isPending && <p style={muted}>Cargando…</p>}
      {stages.map((s, i) => (
        <StageRow
          key={s.id}
          stage={s}
          first={i === 0}
          last={i === stages.length - 1}
          onUp={() => move(i, -1)}
          onDown={() => move(i, 1)}
          onDelete={() => remove.mutate(s.id)}
        />
      ))}
    </Panel>
  );
}

function StageRow({
  stage,
  first,
  last,
  onUp,
  onDown,
  onDelete,
}: {
  stage: StageDto;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ ...card, display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button onClick={onUp} disabled={first} style={arrowBtn} title="Subir">▲</button>
        <button onClick={onDown} disabled={last} style={arrowBtn} title="Bajar">▼</button>
      </div>
      <strong style={{ flex: 1, minWidth: 0 }}>{stage.name}</strong>
      {stage.isWon && <span style={badge("#1f6f46")}>ganada</span>}
      {stage.isLost && <span style={badge("#6f2f2f")}>perdida</span>}
      <button
        onClick={() => {
          void confirmDialog({
            message: `¿Eliminar la etapa "${stage.name}"? Los deals en esta etapa quedarán sin columna.`,
            danger: true,
          }).then((ok) => ok && onDelete());
        }}
        style={dangerBtn}
        title="Eliminar"
      >
        ✕
      </button>
    </div>
  );
}

// ── Layout compartido ────────────────────────────────────────
function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <header>
        <h3 style={{ margin: "0 0 4px" }}>{title}</h3>
        <p style={muted}>{subtitle}</p>
      </header>
      {children}
    </div>
  );
}

const muted: React.CSSProperties = { color: "var(--muted)", fontSize: 14, marginTop: 0 };

const card: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 12,
  boxShadow: "var(--shadow-card)",
};

const input: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--field)",
  color: "var(--text)",
  fontSize: 14,
};

const swatch: React.CSSProperties = {
  width: 38,
  height: 38,
  padding: 0,
  border: "none",
  background: "none",
  cursor: "pointer",
  flexShrink: 0,
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const dangerBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid #5a2a2a",
  background: "transparent",
  color: "#e08a8a",
  cursor: "pointer",
  fontSize: 13,
  flexShrink: 0,
};

const arrowBtn: React.CSSProperties = {
  width: 22,
  height: 16,
  lineHeight: "10px",
  borderRadius: 4,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 8,
  padding: 0,
};

function badge(bg: string): React.CSSProperties {
  return {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: bg,
    color: "#eaf2ff",
    whiteSpace: "nowrap",
  };
}
