"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { confirmDialog } from "@/lib/confirm";
import type { CreateProductInput, ProductDto } from "@crm/shared";
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
} from "@/lib/bff";

// Al pegar una imagen es fácil olvidar el esquema ("midominio.com/foto.jpg").
// Se añade https:// para que no lo rechace la validación de URL.
function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function formatPrice(price: number, currency: string): string {
  try {
    return price.toLocaleString("es", { style: "currency", currency });
  } catch {
    return `${price.toFixed(2)} ${currency}`;
  }
}

export function ProductsManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProductDto | "new" | null>(null);

  const { data: products, isPending } = useQuery({
    queryKey: ["products", search],
    queryFn: () => fetchProducts(search),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["products"] });

  const remove = useMutation({
    mutationFn: deleteProduct,
    onSuccess: refresh,
  });

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          style={search_}
          value={search}
          placeholder="Buscar por nombre o SKU…"
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => setEditing("new")} style={primaryBtn}>
          + Nuevo producto
        </button>
      </div>

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {isPending && <p style={muted}>Cargando…</p>}

      <div style={grid}>
        {(products ?? []).map((p) => (
          <div key={p.id} style={card}>
            <div style={thumb}>
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 28, opacity: 0.4 }}>📦</span>
              )}
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 14 }}>{p.name}</strong>
                {!p.isActive && <span style={badge}>inactivo</span>}
              </div>
              {p.sku && <div style={{ ...muted, fontSize: 12 }}>SKU: {p.sku}</div>}
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6, color: "#7ee2a8" }}>
                {formatPrice(p.price, p.currency)}
              </div>
              {p.description && (
                <p style={{ ...muted, fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                  {p.description}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => setEditing(p)} style={ghostBtn}>
                  Editar
                </button>
                <button
                  onClick={() => {
                    void confirmDialog({
                      message: `¿Eliminar "${p.name}"?`,
                      danger: true,
                    }).then((ok) => ok && remove.mutate(p.id));
                  }}
                  style={{ ...ghostBtn, color: "#e08a8a", borderColor: "#5a2a2a" }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
        {products && products.length === 0 && !isPending && (
          <p style={muted}>No hay productos.</p>
        )}
      </div>
    </div>
  );
}

function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product: ProductDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !product;
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [currency, setCurrency] = useState(product?.currency ?? "USD");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  const save = useMutation({
    mutationFn: () => {
      const payload: CreateProductInput = {
        name: name.trim(),
        sku: sku.trim() || null,
        price: Number(price) || 0,
        currency: currency.trim().toUpperCase().slice(0, 3) || "USD",
        imageUrl: normalizeUrl(imageUrl),
        description: description.trim() || null,
        isActive,
      };
      return isNew ? createProduct(payload) : updateProduct(product!.id, payload);
    },
    onSuccess: onSaved,
  });

  return (
    <div style={{ ...card, padding: 16, marginTop: 14 }}>
      <strong>{isNew ? "Nuevo producto" : "Editar producto"}</strong>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <input style={input} value={name} placeholder="Nombre" onChange={(e) => setName(e.target.value)} />
        <input style={{ ...input, width: 140 }} value={sku} placeholder="SKU" onChange={(e) => setSku(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <input style={{ ...input, width: 140 }} type="number" min={0} step="0.01" value={price} placeholder="Precio" onChange={(e) => setPrice(e.target.value)} />
        <input style={{ ...input, width: 90 }} value={currency} placeholder="USD" onChange={(e) => setCurrency(e.target.value)} />
        <input style={input} value={imageUrl} placeholder="URL de imagen (opcional)" onChange={(e) => setImageUrl(e.target.value)} />
      </div>
      <textarea
        style={{ ...input, minHeight: 60, resize: "vertical", marginTop: 10, fontFamily: "inherit" }}
        value={description}
        placeholder="Descripción (opcional)"
        onChange={(e) => setDescription(e.target.value)}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 14 }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Activo
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
        {save.isError && <span style={{ color: "#ff6b6b", fontSize: 13, alignSelf: "center" }}>{(save.error as Error).message}</span>}
        <button onClick={onClose} style={ghostBtn}>Cancelar</button>
        <button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending} style={primaryBtn}>
          {save.isPending ? "Guardando…" : isNew ? "Crear" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
  gap: 14,
  marginTop: 18,
};

const card: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  overflow: "hidden",
  boxShadow: "var(--shadow-card)",
};

const thumb: React.CSSProperties = {
  height: 120,
  background: "#0d1320",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const muted: React.CSSProperties = { color: "var(--muted)", fontSize: 14 };

const search_: React.CSSProperties = {
  flex: 1,
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 14,
};

const input: React.CSSProperties = {
  flex: 1,
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 14,
  boxSizing: "border-box",
};

const badge: React.CSSProperties = {
  fontSize: 10,
  padding: "1px 7px",
  borderRadius: 999,
  background: "#5a4a2a",
  color: "#e9f1ff",
  alignSelf: "flex-start",
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
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 13,
};
