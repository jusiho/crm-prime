"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { confirmDialog } from "@/lib/confirm";
import {
  contactOriginLabels,
  customFieldTypes,
  type ContactListItem,
  type ContactOrigin,
  type CustomFieldDto,
  type SourceDto,
} from "@crm/shared";
import {
  createContact,
  createCustomField,
  createDeal,
  deleteCustomField,
  fetchContactDirectory,
  fetchCustomFields,
  fetchSources,
  setContactSource,
  updateContact,
} from "@/lib/bff";

export function ContactsManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  const { data: contacts, isPending } = useQuery({
    queryKey: ["contact-directory", search],
    queryFn: () => fetchContactDirectory(search),
  });
  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });
  const { data: fields = [] } = useQuery({
    queryKey: ["custom-fields"],
    queryFn: fetchCustomFields,
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["contact-directory"] });

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          style={searchInput}
          value={search}
          placeholder="Buscar por nombre o teléfono…"
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => setShowWebhook((v) => !v)} style={ghostBtn}>
          🔗 Webhook
        </button>
        <button onClick={() => setShowFields((v) => !v)} style={ghostBtn}>
          ⚙ Campos
        </button>
        <button onClick={() => setCreating((v) => !v)} style={primaryBtn}>
          + Nuevo contacto
        </button>
      </div>

      {showWebhook && <WebhookInfo />}
      {showFields && <CustomFieldsPanel fields={fields} />}

      {creating && (
        <NewContactForm
          sources={sources}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}

      {isPending && <p style={muted}>Cargando…</p>}

      <table style={table}>
        <thead>
          <tr>
            <Th>Contacto</Th>
            <Th>Llegó por</Th>
            <Th>Fuente</Th>
            <Th>Etiquetas</Th>
            <Th>Opt-in</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {(contacts ?? []).map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              sources={sources}
              fields={fields}
              onChanged={refresh}
            />
          ))}
        </tbody>
      </table>
      {contacts && contacts.length === 0 && !isPending && (
        <p style={muted}>No hay contactos.</p>
      )}
    </div>
  );
}

function WebhookInfo() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/api/v1/webhooks/lead`;
  const example = `curl -X POST ${url} \\
  -H "x-webhook-token: TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"+51999...","name":"Ana","source":"Facebook Ads","tags":["nuevo"],"fields":{"ciudad":"Lima"}}'`;
  return (
    <div style={infoBox}>
      <strong>Webhook para recibir leads</strong>
      <p style={{ ...muted, margin: "6px 0" }}>
        Envía leads desde landing pages, anuncios, n8n o Zapier con un{" "}
        <code>POST</code> a esta URL y el header{" "}
        <code>x-webhook-token</code> = tu <code>LEAD_WEBHOOK_TOKEN</code>. Crea o
        actualiza el contacto por teléfono (fuente, etiquetas y campos incluidos).
      </p>
      <code style={urlBox}>{url}</code>
      <pre style={pre}>{example}</pre>
    </div>
  );
}

function CustomFieldsPanel({ fields }: { fields: CustomFieldDto[] }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState("");
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
    queryClient.invalidateQueries({ queryKey: ["contact-directory"] });
  };

  const create = useMutation({
    mutationFn: () =>
      createCustomField({
        label: label.trim(),
        type: type as CustomFieldDto["type"],
        options:
          type === "select"
            ? options.split(",").map((o) => o.trim()).filter(Boolean)
            : [],
      }),
    onSuccess: () => {
      setLabel("");
      setOptions("");
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: deleteCustomField, onSuccess: refresh });

  return (
    <div style={infoBox}>
      <strong>Campos personalizados del lead</strong>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
        {fields.map((f) => (
          <span key={f.id} style={fieldChip}>
            {f.label} <span style={{ opacity: 0.6 }}>· {f.type}</span>
            <button
              onClick={() => {
                void confirmDialog({
                  message: `¿Eliminar el campo "${f.label}"?`,
                  danger: true,
                }).then((ok) => ok && remove.mutate(f.id));
              }}
              style={chipX}
            >
              ✕
            </button>
          </span>
        ))}
        {fields.length === 0 && <span style={muted}>Aún no hay campos.</span>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...input, minWidth: 160 }} value={label} placeholder="Nombre del campo (ej. Ciudad)" onChange={(e) => setLabel(e.target.value)} />
        <select style={{ ...input, minWidth: 120, flex: "0 0 auto" }} value={type} onChange={(e) => setType(e.target.value)}>
          {customFieldTypes.map((t) => (
            <option key={t} value={t}>
              {t === "text" ? "Texto" : t === "number" ? "Número" : t === "date" ? "Fecha" : "Lista"}
            </option>
          ))}
        </select>
        {type === "select" && (
          <input style={{ ...input, minWidth: 160 }} value={options} placeholder="Opciones (coma)" onChange={(e) => setOptions(e.target.value)} />
        )}
        <button onClick={() => create.mutate()} disabled={!label.trim() || create.isPending} style={primaryBtn}>
          Añadir campo
        </button>
      </div>
    </div>
  );
}

function ContactRow({
  contact: c,
  sources,
  fields,
  onChanged,
}: {
  contact: ContactListItem;
  sources: SourceDto[];
  fields: CustomFieldDto[];
  onChanged: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(c.name ?? "");
  const [values, setValues] = useState<Record<string, string>>(c.fields ?? {});

  const saveFields = useMutation({
    mutationFn: () => updateContact(c.id, { fields: values }),
    onSuccess: onChanged,
  });

  const saveName = useMutation({
    mutationFn: () => updateContact(c.id, { name: name.trim() || null }),
    onSuccess: () => {
      setEditingName(false);
      onChanged();
    },
  });
  const saveSource = useMutation({
    mutationFn: (sourceId: string | null) => setContactSource(c.id, sourceId),
    onSuccess: onChanged,
  });
  const saveOptIn = useMutation({
    mutationFn: (optIn: boolean) => updateContact(c.id, { optIn }),
    onSuccess: onChanged,
  });
  const newDeal = useMutation({
    mutationFn: () =>
      createDeal({
        contactId: c.id,
        title: `Oportunidad: ${c.name ?? c.phone}`,
        currency: "USD",
      }),
  });

  return (
    <>
    <tr style={tr}>
      <td style={td}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={avatar}>{(c.name ?? c.phone)[0]?.toUpperCase()}</span>
          <div>
            {editingName ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  autoFocus
                  style={miniInput}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName.mutate();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                />
                <button onClick={() => saveName.mutate()} style={miniBtn} disabled={saveName.isPending}>✓</button>
              </div>
            ) : (
              <strong
                style={{ fontSize: 14, cursor: "pointer" }}
                title="Clic para editar"
                onClick={() => {
                  setName(c.name ?? "");
                  setEditingName(true);
                }}
              >
                {c.name ?? "(sin nombre)"} <span style={{ opacity: 0.4, fontSize: 11 }}>✎</span>
              </strong>
            )}
            <div style={{ ...muted, fontSize: 12 }}>{c.phone}</div>
          </div>
        </div>
      </td>
      <td style={td}>
        <OriginBadge origin={c.origin} detail={c.originDetail} />
      </td>
      <td style={td}>
        <select
          value={c.source?.id ?? ""}
          onChange={(e) => saveSource.mutate(e.target.value || null)}
          disabled={saveSource.isPending}
          style={select}
        >
          <option value="">— Sin fuente —</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </td>
      <td style={td}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {c.tags.map((t) => (
            <span key={t.name} style={chip(t.color)}>
              {t.name}
            </span>
          ))}
          {c.tags.length === 0 && <span style={muted}>—</span>}
        </div>
      </td>
      <td style={td}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={c.optIn}
            onChange={(e) => saveOptIn.mutate(e.target.checked)}
          />
          <span style={{ color: c.optIn ? "#7ee2a8" : "#e08a8a", fontSize: 13 }}>
            {c.optIn ? "Sí" : "No"}
          </span>
        </label>
      </td>
      <td style={td}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/" style={linkBtn}>
            Abrir chat
          </Link>
          <button
            onClick={() => newDeal.mutate()}
            disabled={newDeal.isPending || newDeal.isSuccess}
            style={ghostBtn}
            title="Crear una oportunidad en el pipeline"
          >
            {newDeal.isSuccess ? "✓ Creada" : newDeal.isPending ? "…" : "+ Oportunidad"}
          </button>
          {fields.length > 0 && (
            <button onClick={() => setExpanded((v) => !v)} style={ghostBtn}>
              {expanded ? "Ocultar" : "Detalles"}
            </button>
          )}
        </div>
      </td>
    </tr>
    {expanded && fields.length > 0 && (
      <tr style={tr}>
        <td style={{ ...td, background: "#0d1320" }} colSpan={6}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            {fields.map((f) => (
              <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{f.label}</span>
                {f.type === "select" ? (
                  <select
                    style={select}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  >
                    <option value="">—</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    style={miniInput}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <button onClick={() => saveFields.mutate()} disabled={saveFields.isPending} style={primaryBtn}>
              {saveFields.isPending ? "Guardando…" : "Guardar campos"}
            </button>
          </div>
        </td>
      </tr>
    )}
    </>
  );
}

function NewContactForm({
  sources,
  onClose,
  onSaved,
}: {
  sources: SourceDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      createContact({ name: name.trim() || null, phone: phone.trim(), sourceId }),
    onSuccess: onSaved,
  });

  return (
    <div style={formBox}>
      <input style={input} value={name} placeholder="Nombre" onChange={(e) => setName(e.target.value)} />
      <input style={input} value={phone} placeholder="Teléfono (+51…)" onChange={(e) => setPhone(e.target.value)} />
      <select style={input} value={sourceId ?? ""} onChange={(e) => setSourceId(e.target.value || null)}>
        <option value="">— Sin fuente —</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {save.isError && (
        <span style={{ color: "#ff6b6b", fontSize: 13, alignSelf: "center" }}>
          {(save.error as Error).message}
        </span>
      )}
      <button onClick={onClose} style={ghostBtn}>Cancelar</button>
      <button
        onClick={() => save.mutate()}
        disabled={!phone.trim() || save.isPending}
        style={primaryBtn}
      >
        {save.isPending ? "Guardando…" : "Crear"}
      </button>
    </div>
  );
}

// Procedencia técnica: por qué vía entró el contacto. `detail` precisa cuál
// (el número de WhatsApp que lo recibió, la integración del webhook…).
function OriginBadge({
  origin,
  detail,
}: {
  origin: ContactOrigin;
  detail: string | null;
}) {
  return (
    <span
      style={originBadge(ORIGIN_COLORS[origin])}
      title={detail ? `${contactOriginLabels[origin]} · ${detail}` : contactOriginLabels[origin]}
    >
      {ORIGIN_ICONS[origin]} {contactOriginLabels[origin]}
      {detail && (
        <span style={{ opacity: 0.65, marginLeft: 5 }}>
          {detail.length > 18 ? `${detail.slice(0, 18)}…` : detail}
        </span>
      )}
    </span>
  );
}

const ORIGIN_COLORS: Record<ContactOrigin, string> = {
  ad: "#7a5fb0",
  whatsapp: "#1f4d38",
  webhook: "#2c4b7a",
  manual: "#3a3a3a",
  import: "#5a4a2a",
};

const ORIGIN_ICONS: Record<ContactOrigin, string> = {
  ad: "📣",
  whatsapp: "💬",
  webhook: "🔗",
  manual: "✍️",
  import: "📥",
};

function originBadge(bg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    fontSize: 11.5,
    padding: "3px 9px",
    borderRadius: 999,
    background: bg,
    color: "#eaf2ff",
    whiteSpace: "nowrap",
  };
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "var(--muted)", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>
      {children}
    </th>
  );
}

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 18,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  overflow: "hidden",
  boxShadow: "var(--shadow-card)",
};

const tr: React.CSSProperties = { borderBottom: "1px solid var(--border)" };
const td: React.CSSProperties = { padding: "12px", fontSize: 14, verticalAlign: "middle" };
const muted: React.CSSProperties = { color: "var(--muted)", fontSize: 14 };

const searchInput: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 14,
  boxSizing: "border-box",
};

const formBox: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  marginTop: 12,
  padding: 14,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  flexWrap: "wrap",
};

const input: React.CSSProperties = {
  flex: 1,
  minWidth: 140,
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 14,
  boxSizing: "border-box",
};

const miniInput: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 13,
};

const select: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 13,
};

const avatar: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "#22304a",
  color: "#cfe0ff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 700,
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

const ghostBtn: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const miniBtn: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 6,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  cursor: "pointer",
  fontWeight: 700,
};

const linkBtn: React.CSSProperties = {
  fontSize: 13,
  color: "var(--accent)",
  textDecoration: "none",
};

const infoBox: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
};

const urlBox: React.CSSProperties = {
  display: "block",
  padding: "8px 10px",
  background: "#0d1320",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 13,
  color: "#7ee2a8",
  wordBreak: "break-all",
};

const pre: React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  background: "#0d1320",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 12,
  color: "#aebfd6",
  overflowX: "auto",
  whiteSpace: "pre-wrap",
};

const fieldChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  padding: "4px 10px",
  borderRadius: 999,
  background: "#22304a",
  color: "#cfe0ff",
};

const chipX: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#cfe0ff",
  cursor: "pointer",
  fontSize: 11,
  opacity: 0.7,
  padding: 0,
};

function chip(color: string | null): React.CSSProperties {
  const bg =
    color && /^#?[0-9a-fA-F]{3,8}$/.test(color)
      ? color.startsWith("#")
        ? color
        : `#${color}`
      : "#2c4b7a";
  return {
    fontSize: 11,
    padding: "2px 9px",
    borderRadius: 999,
    background: bg,
    color: "#eaf2ff",
  };
}
