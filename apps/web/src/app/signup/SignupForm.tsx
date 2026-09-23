"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { suggestSlug } from "@crm/shared";
import { checkSlug, registerOrg, type SignupState } from "./actions";

type Estado = { tipo: "vacio" | "comprobando" | "libre" | "ocupado"; motivo?: string };

export function SignupForm({ baseDomain }: { baseDomain: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    registerOrg,
    {},
  );
  const [slug, setSlug] = useState("");
  // Si el usuario edita el subdominio a mano, dejamos de sugerirlo: pisarle lo
  // que escribió es de las cosas que más molestan de un formulario.
  const [slugTocado, setSlugTocado] = useState(false);
  const [estado, setEstado] = useState<Estado>({ tipo: "vacio" });
  const [, startTransition] = useTransition();

  // Comprobación con retardo: una llamada por tecla sería una llamada por
  // tecla, y el subdominio se escribe entero antes de significar nada.
  useEffect(() => {
    if (slug.length < 3) {
      setEstado({ tipo: "vacio" });
      return;
    }
    setEstado({ tipo: "comprobando" });
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await checkSlug(slug);
        setEstado(
          r.available
            ? { tipo: "libre" }
            : { tipo: "ocupado", motivo: r.reason },
        );
      });
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  if (state.url) {
    return (
      <div style={caja}>
        <h1 style={{ marginTop: 0 }}>Empresa creada</h1>
        <p style={{ color: "var(--muted)" }}>
          El panel de tu empresa ya está listo. Guarda esta dirección: es por
          donde entrará tu equipo.
        </p>
        <a href={state.url} style={{ ...boton, display: "block", textAlign: "center" }}>
          Ir a {state.url.replace(/^https?:\/\//, "")}
        </a>
      </div>
    );
  }

  return (
    <form action={action} style={caja}>
      <h1 style={{ marginTop: 0 }}>Crea tu empresa</h1>
      <p style={{ color: "var(--muted)", marginTop: -8 }}>
        Tendrás tu propio panel en un minuto.
      </p>

      <label style={etiqueta}>Nombre de la empresa</label>
      <input
        name="companyName"
        required
        placeholder="Acme S.A."
        style={campo}
        onChange={(e) => {
          if (!slugTocado) setSlug(suggestSlug(e.target.value));
        }}
      />

      <label style={etiqueta}>Tu dirección</label>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <input
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTocado(true);
            setSlug(e.target.value.toLowerCase());
          }}
          placeholder="acme"
          style={{ ...campo, borderTopRightRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 }}
        />
        <span style={sufijo}>.{baseDomain}</span>
      </div>
      <p style={{ ...pista, color: colorEstado(estado) }}>{textoEstado(estado)}</p>

      <label style={etiqueta}>Tu nombre</label>
      <input name="adminName" required placeholder="Ana Pérez" style={campo} />

      <label style={etiqueta}>Tu correo</label>
      <input name="adminEmail" type="email" required placeholder="ana@acme.com" style={campo} />

      <label style={etiqueta}>Contraseña</label>
      <input name="password" type="password" required minLength={8} style={campo} />
      <p style={pista}>Mínimo 8 caracteres.</p>

      {state.error && <p style={{ color: "#ff6b6b" }}>{state.error}</p>}

      <button type="submit" style={boton} disabled={pending || estado.tipo === "ocupado"}>
        {pending ? "Creando…" : "Crear empresa"}
      </button>
    </form>
  );
}

function textoEstado(e: Estado): string {
  if (e.tipo === "vacio") return "Mínimo 3 caracteres: letras, números y guiones.";
  if (e.tipo === "comprobando") return "Comprobando…";
  if (e.tipo === "libre") return "Disponible";
  return e.motivo ?? "No disponible";
}

function colorEstado(e: Estado): string {
  if (e.tipo === "libre") return "#4ade80";
  if (e.tipo === "ocupado") return "#ff6b6b";
  return "var(--muted)";
}

const caja: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  padding: 28,
  borderRadius: 14,
  background: "var(--panel, #16181d)",
  border: "1px solid var(--border, #262a31)",
};
const etiqueta: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  marginBottom: 6,
  marginTop: 14,
};
const campo: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border, #262a31)",
  background: "var(--bg, #0f1115)",
  color: "inherit",
  marginBottom: 2,
};
const sufijo: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "0 8px 8px 0",
  border: "1px solid var(--border, #262a31)",
  borderLeft: "none",
  background: "var(--panel, #16181d)",
  color: "var(--muted)",
  whiteSpace: "nowrap",
};
const pista: React.CSSProperties = { fontSize: 12, marginTop: 6, marginBottom: 0 };
const boton: React.CSSProperties = {
  width: "100%",
  marginTop: 22,
  padding: "11px 14px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent, #4f8cff)",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
};
