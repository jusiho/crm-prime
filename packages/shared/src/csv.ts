// Lector de CSV (RFC 4180) compartido por la web y la API, para que la vista
// previa muestre exactamente lo mismo que acabará guardándose.

const DELIMITERS = [",", ";", "\t"] as const;

/**
 * Adivina el separador mirando la primera línea. Excel en español exporta con
 * ";" y en inglés con ",", así que asumir la coma rompe la mitad de los casos.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/)[0] ?? "";
  let best = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    // Solo cuentan los separadores fuera de comillas.
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const c = firstLine[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

/**
 * Convierte el texto en filas. Respeta comillas, comillas escapadas ("")
 * y saltos de línea dentro de un campo.
 */
export function parseCsv(text: string, delimiter?: string): CsvTable {
  const clean = text.replace(/^﻿/, "");
  const sep = delimiter ?? detectDelimiter(clean);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];

    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  // Última fila (los archivos no siempre acaban en salto de línea).
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Fuera filas totalmente vacías (típicas al final del archivo).
  const data = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const [first, ...rest] = data;
  if (!first) return { headers: [], rows: [] };

  return { headers: first.map((h) => h.trim()), rows: rest };
}

/** Convierte cada fila en un objeto con las cabeceras como claves. */
export function csvToRecords(table: CsvTable): Record<string, string>[] {
  return table.rows.map((row) => {
    const record: Record<string, string> = {};
    table.headers.forEach((h, i) => {
      record[h] = (row[i] ?? "").trim();
    });
    return record;
  });
}

/** Genera un CSV a partir de filas de texto (para la plantilla de ejemplo). */
export function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) =>
    /[",;\t\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  return [headers, ...rows]
    .map((r) => r.map(escape).join(","))
    .join("\r\n");
}
