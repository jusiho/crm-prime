"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  PRODUCT_IMPORT_FIELDS,
  csvToRecords,
  guessColumnMapping,
  parseCsv,
  toCsv,
  toProductImportRow,
  type ImportProductsResult,
  type ProductImportField,
  type ProductImportRow,
} from "@crm/shared";
import { importProducts } from "@/lib/bff";
import { NavIcon } from "@/components/NavIcons";

type Mapping = Record<ProductImportField, string | null>;

interface Parsed {
  fileName: string;
  headers: string[];
  records: Record<string, string>[];
}

const PREVIEW_ROWS = 6;

/**
 * Importa productos desde un CSV. El archivo se lee aquí (nunca se sube), se
 * muestra una vista previa con la correspondencia de columnas y solo se envían
 * las filas ya validadas.
 */
export function ImportProductsDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportProductsResult | null>(null);

  // Cada fila del archivo, ya convertida a producto o con su motivo de error.
  const rows = useMemo(() => {
    if (!parsed || !mapping) return [];
    return parsed.records.map((record, i) => ({
      line: i + 2, // +2: la 1 es la cabecera
      ...toProductImportRow(record, mapping),
    }));
  }, [parsed, mapping]);

  const valid = rows.filter((r) => r.ok) as {
    line: number;
    ok: true;
    value: ProductImportRow;
  }[];
  const invalid = rows.filter((r) => !r.ok) as {
    line: number;
    ok: false;
    error: string;
  }[];

  const importMut = useMutation({
    mutationFn: () =>
      importProducts({
        rows: valid.map((r) => r.value),
        updateExisting,
      }),
    onSuccess: (r) => {
      setResult(r);
      onImported();
    },
  });

  async function onFile(file: File) {
    setReadError(null);
    setResult(null);
    try {
      const text = await file.text();
      const table = parseCsv(text);
      if (table.headers.length === 0) {
        setReadError("El archivo está vacío.");
        return;
      }
      const records = csvToRecords(table);
      if (records.length === 0) {
        setReadError("El archivo solo tiene la fila de títulos.");
        return;
      }
      setParsed({ fileName: file.name, headers: table.headers, records });
      setMapping(guessColumnMapping(table.headers));
    } catch (e) {
      setReadError(`No se pudo leer el archivo: ${(e as Error).message}`);
    }
  }

  function downloadTemplate() {
    const csv = toCsv(
      ["nombre", "sku", "precio", "moneda", "descripcion", "imagen", "activo"],
      [
        ["Camiseta azul", "CAM-001", "59.90", "PEN", "Algodón 100%", "https://misitio.com/camiseta.jpg", "si"],
        ["Gorra negra", "GOR-002", "29.90", "PEN", "", "", "si"],
      ],
    );
    const url = URL.createObjectURL(
      new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-productos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const missingRequired = PRODUCT_IMPORT_FIELDS.filter(
    (f) => f.required && mapping && !mapping[f.key],
  );

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div
        className="confirm-dialog"
        style={{ width: 720, maxHeight: "86vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 4px" }}>Importar productos desde CSV</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          Sube el archivo que exportaste de Excel o Google Sheets. Los que
          tengan un SKU que ya existe se actualizan; el resto se crean.
        </p>

        {/* Resultado final */}
        {result ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 20 }}>
              <Stat label="Creados" value={result.created} color="#7ee2a8" />
              <Stat label="Actualizados" value={result.updated} color="#7fb7ff" />
              <Stat
                label="Omitidos"
                value={result.skipped}
                color={result.skipped ? "#e0b766" : undefined}
              />
            </div>
            {result.errors.length > 0 && (
              <div style={errorBox}>
                {result.errors.slice(0, 20).map((e) => (
                  <div key={e.row}>
                    Fila {e.row}: {e.message}
                  </div>
                ))}
                {result.errors.length > 20 && (
                  <div>y {result.errors.length - 20} más…</div>
                )}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={onClose} style={primaryBtn}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Paso 1: archivo */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                  e.target.value = "";
                }}
              />
              <button onClick={() => fileRef.current?.click()} style={primaryBtn}>
                {parsed ? "Elegir otro archivo" : "Elegir archivo CSV"}
              </button>
              <button onClick={downloadTemplate} style={ghostBtn}>
                Descargar plantilla de ejemplo
              </button>
              {parsed && (
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  {parsed.fileName} · {parsed.records.length} fila(s)
                </span>
              )}
            </div>

            {readError && (
              <p style={{ color: "#ff6b6b", fontSize: 13 }}>{readError}</p>
            )}

            {parsed && mapping && (
              <>
                {/* Paso 2: columnas */}
                <h4 style={{ margin: "18px 0 8px" }}>Columnas</h4>
                <div style={mapGrid}>
                  {PRODUCT_IMPORT_FIELDS.map((f) => (
                    <label key={f.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ width: 110, fontSize: 13, color: "var(--muted)" }}>
                        {f.label}
                        {f.required && <span style={{ color: "#e08a8a" }}> *</span>}
                      </span>
                      <select
                        style={select}
                        value={mapping[f.key] ?? ""}
                        onChange={(e) =>
                          setMapping({ ...mapping, [f.key]: e.target.value || null })
                        }
                      >
                        <option value="">— sin usar —</option>
                        {parsed.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                {missingRequired.length > 0 && (
                  <p style={{ color: "#e0b766", fontSize: 13 }}>
                    <NavIcon name="alert" size={13} /> Falta indicar:{" "}
                    {missingRequired.map((f) => f.label).join(", ")}
                  </p>
                )}

                {/* Paso 3: vista previa */}
                <h4 style={{ margin: "18px 0 8px" }}>
                  Vista previa · {valid.length} lista(s) para importar
                  {invalid.length > 0 && `, ${invalid.length} con problemas`}
                </h4>
                <div style={{ overflowX: "auto" }}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={th}>Fila</th>
                        <th style={th}>Nombre</th>
                        <th style={th}>SKU</th>
                        <th style={th}>Precio</th>
                        <th style={th}>Activo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, PREVIEW_ROWS).map((r) => (
                        <tr key={r.line}>
                          <td style={td}>{r.line}</td>
                          {r.ok ? (
                            <>
                              <td style={td}>{r.value.name}</td>
                              <td style={td}>{r.value.sku ?? "—"}</td>
                              <td style={td}>
                                {r.value.price.toFixed(2)} {r.value.currency}
                              </td>
                              <td style={td}>{r.value.isActive ? "Sí" : "No"}</td>
                            </>
                          ) : (
                            <td style={{ ...td, color: "#e08a8a" }} colSpan={4}>
                              {r.error}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > PREVIEW_ROWS && (
                  <p style={{ color: "var(--muted)", fontSize: 12.5 }}>
                    Se muestran las primeras {PREVIEW_ROWS} filas.
                  </p>
                )}

                {invalid.length > 0 && (
                  <div style={errorBox}>
                    {invalid.slice(0, 10).map((r) => (
                      <div key={r.line}>
                        Fila {r.line}: {r.error}
                      </div>
                    ))}
                    {invalid.length > 10 && <div>y {invalid.length - 10} más…</div>}
                    <div style={{ marginTop: 6 }}>
                      Estas filas no se importan; el resto sí.
                    </div>
                  </div>
                )}

                <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                  />
                  Actualizar los productos cuyo SKU ya exista
                </label>
              </>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              {importMut.isError && (
                <span style={{ color: "#ff6b6b", fontSize: 13, alignSelf: "center" }}>
                  {(importMut.error as Error).message}
                </span>
              )}
              <button onClick={onClose} style={ghostBtn}>
                Cancelar
              </button>
              <button
                onClick={() => importMut.mutate()}
                disabled={valid.length === 0 || importMut.isPending}
                style={primaryBtn}
              >
                {importMut.isPending
                  ? "Importando…"
                  : `Importar ${valid.length} producto(s)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color ?? "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

const mapGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 8,
};

const select: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "7px 9px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0d1320",
  color: "var(--text)",
  fontSize: 13,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  color: "var(--muted)",
  fontWeight: 500,
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--border)",
};

const errorBox: React.CSSProperties = {
  background: "rgba(200,80,80,0.1)",
  border: "1px solid #5a2a2a",
  borderRadius: 8,
  padding: 10,
  fontSize: 12.5,
  color: "#ffb3b3",
  marginTop: 10,
  maxHeight: 160,
  overflowY: "auto",
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
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 13,
};
