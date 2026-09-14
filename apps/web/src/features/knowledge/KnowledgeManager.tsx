"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { KnowledgeHit } from "@crm/shared";
import {
  deleteKnowledge,
  fetchKnowledge,
  ingestKnowledge,
  searchKnowledge,
} from "@/lib/bff";

export function KnowledgeManager() {
  const queryClient = useQueryClient();
  const { data: docs = [], isPending } = useQuery({
    queryKey: ["knowledge"],
    queryFn: fetchKnowledge,
  });

  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [content, setContent] = useState("");

  const add = useMutation({
    mutationFn: () =>
      ingestKnowledge({ title: title.trim(), content: content.trim(), source: source.trim() || undefined }),
    onSuccess: () => {
      setTitle("");
      setSource("");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteKnowledge(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Base de conocimiento (RAG)</h2>
      <p style={{ color: "var(--muted)", marginTop: -8 }}>
        Sube documentos del negocio (precios, políticas, FAQs). Se trocean e
        indexan con embeddings; el agente IA los consulta para responder con
        información real.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Alta de documento */}
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Nuevo documento</h3>
          <input
            style={input}
            placeholder="Título (ej. Lista de precios 2026)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            style={{ ...input, marginTop: 8 }}
            placeholder="Fuente (opcional)"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <textarea
            style={{ ...input, marginTop: 8, minHeight: 180, resize: "vertical", fontFamily: "inherit" }}
            placeholder="Pega aquí el contenido…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button
            onClick={() => title.trim() && content.trim() && add.mutate()}
            disabled={add.isPending}
            style={{ ...primaryBtn, marginTop: 10 }}
          >
            {add.isPending ? "Indexando…" : "Indexar documento"}
          </button>
          {add.isError && (
            <p style={{ color: "#ff6b6b", fontSize: 13 }}>
              {(add.error as Error).message}
            </p>
          )}
        </section>

        {/* Búsqueda de prueba */}
        <SearchPreview />
      </div>

      {/* Lista de documentos */}
      <section style={{ ...card, marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Documentos indexados</h3>
        {isPending && <p style={{ color: "var(--muted)" }}>Cargando…</p>}
        {!isPending && docs.length === 0 && (
          <p style={{ color: "var(--muted)" }}>Sin documentos todavía.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((d) => (
            <div key={d.id} style={docRow}>
              <div>
                <strong>{d.title}</strong>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  {d.chunks} fragmentos{d.source ? ` · ${d.source}` : ""} ·{" "}
                  {new Date(d.createdAt).toLocaleDateString("es")}
                </div>
              </div>
              <button
                onClick={() => del.mutate(d.id)}
                disabled={del.isPending}
                style={dangerBtn}
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SearchPreview() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<KnowledgeHit[] | null>(null);
  const search = useMutation({
    mutationFn: () => searchKnowledge(q.trim()),
    onSuccess: (h) => setHits(h),
  });

  return (
    <section style={card}>
      <h3 style={{ marginTop: 0 }}>Probar la búsqueda</h3>
      <p style={{ color: "var(--muted)", marginTop: -6, fontSize: 13 }}>
        Simula lo que el agente recupera para una pregunta.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) search.mutate();
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          style={input}
          placeholder="¿Cuánto cuesta el plan Pro?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" disabled={search.isPending} style={primaryBtn}>
          Buscar
        </button>
      </form>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {hits?.length === 0 && (
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Sin resultados.</span>
        )}
        {hits?.map((h, i) => (
          <div key={i} style={hitBox}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--accent)", fontSize: 12 }}>{h.docTitle}</span>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                score {h.score.toFixed(3)}
              </span>
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{h.content}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const card: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
  boxShadow: "var(--shadow-card)",
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
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
  whiteSpace: "nowrap",
};

const dangerBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid #5a2a2a",
  background: "transparent",
  color: "#e08a8a",
  cursor: "pointer",
};

const docRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 8,
};

const hitBox: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "#0e1420",
};
