"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { confirmDialog } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import type { Role, SellerDto, SourceDto } from "@crm/shared";
import {
  assignSellerSources,
  createSource,
  createUser,
  deleteSource,
  fetchSellers,
  updateUser,
} from "@/lib/bff";
import { PasswordStrength, scorePassword } from "@/components/PasswordStrength";

export function SellersManager() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["sellers"],
    queryFn: fetchSellers,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sellers"] });

  const sources = data?.sources ?? [];
  const sellers = data?.sellers ?? [];

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24, display: "flex", flexDirection: "column", gap: 22 }}>
      {isPending && <p style={muted}>Cargando…</p>}
      {isError && <p style={{ color: "#ff6b6b" }}>{(error as Error).message}</p>}

      {/* Crear usuario */}
      <section>
        <h3 style={{ margin: "0 0 4px" }}>Equipo</h3>
        <p style={{ ...muted, marginTop: 0 }}>
          Crea las cuentas de tu equipo. Los <strong>vendedores</strong> solo ven
          las conversaciones de sus fuentes; los <strong>administradores</strong>
          {" "}ven todo y gestionan la configuración.
        </p>
        <CreateUserForm onCreated={refresh} />
      </section>

      {/* Fuentes */}
      <section>
        <h3 style={{ margin: "0 0 4px" }}>Fuentes</h3>
        <p style={{ ...muted, marginTop: 0 }}>
          El origen de tus leads (Facebook Ads, Instagram, Web, Referido…). Luego
          asignas cada fuente a uno o varios vendedores.
        </p>
        <SourcesEditor sources={sources} onChanged={refresh} />
      </section>

      {/* Vendedores */}
      <section>
        <h3 style={{ margin: "0 0 4px" }}>Usuarios y sus fuentes</h3>
        <p style={{ ...muted, marginTop: 0 }}>
          Cada vendedor verá en su bandeja <strong>solo</strong> las
          conversaciones de los contactos de las fuentes que marques. Los
          administradores ven todo.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sellers.map((s) => (
            <SellerRow key={s.id} seller={s} sources={sources} onSaved={refresh} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("AGENT" as Role);

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole("AGENT" as Role);
  };

  const create = useMutation({
    mutationFn: () =>
      createUser({ name: name.trim(), email: email.trim(), password, role }),
    onSuccess: () => {
      toast.success("Usuario creado");
      reset();
      setOpen(false);
      onCreated();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSubmit =
    name.trim().length > 0 &&
    /.+@.+\..+/.test(email) &&
    password.length >= 8 &&
    scorePassword(password) >= 2;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={primaryBtn}>
        + Nuevo usuario
      </button>
    );
  }

  return (
    <div style={{ ...box, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={fieldLabel}>Nombre</div>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Pérez" />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={fieldLabel}>Correo</div>
          <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@empresa.com" />
        </div>
        <div style={{ width: 150 }}>
          <div style={fieldLabel}>Rol</div>
          <select
            style={{ ...input, padding: "8px 10px" }}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="AGENT">Vendedor</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
      </div>
      <div style={{ maxWidth: 320 }}>
        <div style={fieldLabel}>Contraseña temporal</div>
        <input
          type="password"
          style={input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
        />
        <PasswordStrength value={password} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          style={ghostBtn}
        >
          Cancelar
        </button>
        <button
          onClick={() => create.mutate()}
          disabled={!canSubmit || create.isPending}
          style={primaryBtn}
        >
          {create.isPending ? "Creando…" : "Crear usuario"}
        </button>
      </div>
    </div>
  );
}

function SourcesEditor({
  sources,
  onChanged,
}: {
  sources: SourceDto[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2c4b7a");

  const create = useMutation({
    mutationFn: () => createSource({ name: name.trim(), color }),
    onSuccess: () => {
      setName("");
      onChanged();
    },
  });
  const remove = useMutation({
    mutationFn: deleteSource,
    onSuccess: onChanged,
  });

  return (
    <div style={box}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {sources.map((s) => (
          <span key={s.id} style={chip(s.color)}>
            {s.name}
            <span style={{ opacity: 0.7 }}> · {s.contactCount}</span>
            <button
              onClick={() => {
                void confirmDialog({
                  message: `¿Eliminar la fuente "${s.name}"?`,
                  danger: true,
                }).then((ok) => ok && remove.mutate(s.id));
              }}
              style={chipX}
              title="Eliminar"
            >
              ✕
            </button>
          </span>
        ))}
        {sources.length === 0 && <span style={muted}>Aún no hay fuentes.</span>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ width: 38, height: 38, padding: 0, border: "none", background: "none", cursor: "pointer" }}
          title="Color"
        />
        <input
          style={input}
          value={name}
          placeholder="Nueva fuente (ej. Facebook Ads)"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) create.mutate();
          }}
        />
        <button
          onClick={() => create.mutate()}
          disabled={!name.trim() || create.isPending}
          style={primaryBtn}
        >
          Añadir
        </button>
      </div>
    </div>
  );
}

function SellerRow({
  seller,
  sources,
  onSaved,
}: {
  seller: SellerDto;
  sources: SourceDto[];
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(seller.sourceIds);
  const dirty =
    selected.length !== seller.sourceIds.length ||
    selected.some((id) => !seller.sourceIds.includes(id));

  const save = useMutation({
    mutationFn: () => assignSellerSources(seller.id, selected),
    onSuccess: onSaved,
  });

  const mutateUser = useMutation({
    mutationFn: (patch: Parameters<typeof updateUser>[1]) =>
      updateUser(seller.id, patch),
    onSuccess: onSaved,
    onError: (e) => toast.error((e as Error).message),
  });

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const isAdmin = seller.role === "ADMIN";

  return (
    <div style={{ ...box, opacity: seller.isActive ? 1 : 0.55 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={avatar}>{(seller.name ?? seller.email)[0]?.toUpperCase()}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>{seller.name ?? seller.email}</strong>
            {!seller.isActive && <span style={chip("#5a4a2a")}>inactivo</span>}
          </div>
          <div style={{ ...muted, fontSize: 12 }}>{seller.email}</div>
        </div>
        <select
          value={seller.role}
          onChange={(e) =>
            mutateUser.mutate({ role: e.target.value as Role })
          }
          disabled={mutateUser.isPending}
          title="Rol"
          style={roleSelect}
        >
          <option value="AGENT">Vendedor</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <button
          onClick={() => {
            if (seller.isActive) {
              void confirmDialog({
                message: `¿Desactivar a "${seller.name ?? seller.email}"? Se cerrarán sus sesiones y no podrá entrar.`,
                danger: true,
              }).then((ok) => ok && mutateUser.mutate({ isActive: false }));
            } else {
              mutateUser.mutate({ isActive: true });
            }
          }}
          disabled={mutateUser.isPending}
          style={seller.isActive ? dangerBtn : primaryBtn}
        >
          {seller.isActive ? "Desactivar" : "Reactivar"}
        </button>
        {dirty && !isAdmin && (
          <button onClick={() => save.mutate()} disabled={save.isPending} style={primaryBtn}>
            {save.isPending ? "Guardando…" : "Guardar"}
          </button>
        )}
      </div>
      {isAdmin ? (
        <p style={{ ...muted, fontSize: 13, margin: "10px 0 0" }}>
          Es administrador: ve todas las conversaciones sin importar la fuente.
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {sources.map((s) => {
            const on = selected.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                style={{
                  ...chip(on ? s.color : null),
                  opacity: on ? 1 : 0.45,
                  cursor: "pointer",
                  border: on ? "1px solid transparent" : "1px solid var(--border)",
                  background: on ? chip(s.color).background : "transparent",
                }}
              >
                {s.name}
              </button>
            );
          })}
          {sources.length === 0 && <span style={muted}>Crea fuentes primero.</span>}
        </div>
      )}
    </div>
  );
}

const box: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 16,
  boxShadow: "var(--shadow-card)",
};

const muted: React.CSSProperties = { color: "var(--muted)", fontSize: 14 };

const input: React.CSSProperties = {
  flex: 1,
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 14,
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#f3f8ff",
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 14,
};

const dangerBtn: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "1px solid #5a2a2a",
  background: "transparent",
  color: "#e08a8a",
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const fieldLabel: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--muted)",
  marginBottom: 5,
};

const roleSelect: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--field)",
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
};

function chip(color: string | null): React.CSSProperties {
  const bg =
    color && /^#?[0-9a-fA-F]{3,8}$/.test(color)
      ? color.startsWith("#")
        ? color
        : `#${color}`
      : "#2c4b7a";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    padding: "4px 10px",
    borderRadius: 999,
    background: bg,
    color: "#eaf2ff",
  };
}

const chipX: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#eaf2ff",
  cursor: "pointer",
  fontSize: 11,
  opacity: 0.8,
  padding: 0,
};
