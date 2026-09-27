import { z } from "zod";

export const productDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  description: z.string().nullable(),
  price: z.number(),
  currency: z.string(),
  // Precios en otras monedas (el de arriba es el precio base).
  prices: z.array(z.object({ currency: z.string(), amount: z.number() })).default([]),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type ProductDto = z.infer<typeof productDtoSchema>;

// Mensajes en español: el formulario los muestra tal cual al usuario.
const nameField = z
  .string()
  .min(1, "Escribe un nombre")
  .max(160, "El nombre no puede pasar de 160 caracteres");
const skuField = z
  .string()
  .max(60, "El SKU no puede pasar de 60 caracteres")
  .nullable();
const descriptionField = z
  .string()
  .max(2000, "La descripción no puede pasar de 2000 caracteres")
  .nullable();
const priceField = z.number().min(0, "El precio no puede ser negativo");
const currencyField = z
  .string()
  .length(3, "Usa el código ISO de 3 letras (USD, EUR, PEN, MXN…)")
  .transform((v) => v.toUpperCase());
// Precios adicionales: una entrada por moneda, distinta de la base.
const pricesField = z
  .array(z.object({ currency: currencyField, amount: priceField }))
  .max(20)
  .refine(
    (list) => new Set(list.map((p) => p.currency)).size === list.length,
    "Hay una moneda repetida en los precios",
  );
const imageUrlField = z
  .string()
  .url("La URL de la imagen debe empezar por http:// o https://")
  .nullable();

export const createProductSchema = z.object({
  name: nameField,
  sku: skuField.default(null),
  description: descriptionField.default(null),
  price: priceField.default(0),
  currency: currencyField.default("USD"),
  prices: pricesField.default([]),
  imageUrl: imageUrlField.default(null),
  isActive: z.boolean().default(true),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: nameField.optional(),
  sku: skuField.optional(),
  description: descriptionField.optional(),
  price: priceField.optional(),
  currency: currencyField.optional(),
  // Si viene, sustituye la lista entera de precios adicionales.
  prices: pricesField.optional(),
  imageUrl: imageUrlField.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ── Importación desde CSV ────────────────────────────────────

/** Campos que acepta el importador y cómo pueden venir titulados. */
export const PRODUCT_IMPORT_FIELDS = [
  { key: "name", label: "Nombre", required: true, aliases: ["nombre", "producto", "name", "title", "titulo", "título"] },
  { key: "sku", label: "SKU", required: false, aliases: ["sku", "codigo", "código", "code", "referencia", "ref"] },
  { key: "price", label: "Precio", required: true, aliases: ["precio", "price", "valor", "importe", "monto"] },
  { key: "currency", label: "Moneda", required: false, aliases: ["moneda", "currency", "divisa"] },
  { key: "description", label: "Descripción", required: false, aliases: ["descripcion", "descripción", "description", "detalle", "detalles"] },
  { key: "imageUrl", label: "Imagen (URL)", required: false, aliases: ["imagen", "image", "imageurl", "image_url", "foto", "url imagen", "url de imagen"] },
  { key: "isActive", label: "Activo", required: false, aliases: ["activo", "active", "isactive", "estado", "habilitado", "disponible"] },
] as const;

export type ProductImportField = (typeof PRODUCT_IMPORT_FIELDS)[number]["key"];

const normalizeHeader = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Empareja las columnas del archivo con los campos del producto. Devuelve, por
 * campo, el nombre de la columna encontrada (o null si no hay ninguna).
 */
export function guessColumnMapping(
  headers: string[],
): Record<ProductImportField, string | null> {
  const mapping = {} as Record<ProductImportField, string | null>;
  const used = new Set<string>();
  for (const field of PRODUCT_IMPORT_FIELDS) {
    const match = headers.find(
      (h) =>
        !used.has(h) &&
        (field.aliases as readonly string[]).includes(normalizeHeader(h)),
    );
    mapping[field.key] = match ?? null;
    if (match) used.add(match);
  }
  return mapping;
}

/**
 * Interpreta un precio escrito por personas: "1.234,56", "1,234.56", "S/ 20",
 * "20.5". Se queda con el último separador como decimal.
 */
export function parseImportPrice(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma > -1 && lastDot > -1) {
    // El separador decimal es el que aparece más a la derecha.
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma > -1) {
    // Una sola coma: decimal si deja 1-2 dígitos detrás; si no, es de miles.
    normalized =
      cleaned.length - lastComma - 1 <= 2
        ? cleaned.replace(",", ".")
        : cleaned.replace(/,/g, "");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const TRUTHY = ["si", "sí", "true", "1", "activo", "yes", "y", "x", "verdadero"];
const FALSY = ["no", "false", "0", "inactivo", "n", "falso"];

export function parseImportBoolean(raw: string, fallback = true): boolean {
  const v = normalizeHeader(raw);
  if (!v) return fallback;
  if (TRUTHY.includes(v)) return true;
  if (FALSY.includes(v)) return false;
  return fallback;
}

/**
 * Columnas de precio por moneda: "precio_MXN", "price EUR", "precio (PEN)"…
 * Devuelve la moneda que indican, o null si la columna no es de ese tipo.
 */
export function priceColumnCurrency(header: string): string | null {
  const m = normalizeHeader(header).match(/^(?:precio|price|valor)[\s_(-]+([a-z]{3})\)?$/);
  return m ? m[1]!.toUpperCase() : null;
}

export const productImportRowSchema = z.object({
  name: nameField,
  sku: skuField.default(null),
  description: descriptionField.default(null),
  price: priceField,
  currency: currencyField.default("USD"),
  prices: pricesField.default([]),
  imageUrl: imageUrlField.default(null),
  isActive: z.boolean().default(true),
});
export type ProductImportRow = z.infer<typeof productImportRowSchema>;

/**
 * Convierte una fila del archivo en un producto listo para guardar, o explica
 * en español qué le falta. Lo usan la vista previa y la API, así que lo que se
 * ve antes de importar es lo que se guarda.
 */
export function toProductImportRow(
  record: Record<string, string>,
  mapping: Record<ProductImportField, string | null>,
): { ok: true; value: ProductImportRow } | { ok: false; error: string } {
  const get = (field: ProductImportField): string => {
    const column = mapping[field];
    return column ? (record[column] ?? "").trim() : "";
  };

  const name = get("name");
  if (!name) return { ok: false, error: "Falta el nombre" };

  const rawPrice = get("price");
  const price = rawPrice ? parseImportPrice(rawPrice) : 0;
  if (price === null) return { ok: false, error: `Precio no válido: "${rawPrice}"` };
  if (price < 0) return { ok: false, error: "El precio no puede ser negativo" };

  const rawCurrency = get("currency");
  const currency = rawCurrency ? rawCurrency.trim().toUpperCase() : "USD";
  if (currency.length !== 3) {
    return { ok: false, error: `Moneda no válida: "${rawCurrency}" (usa USD, PEN, EUR…)` };
  }

  // Precios en otras monedas: columnas precio_XXX (vacías se ignoran).
  const prices: { currency: string; amount: number }[] = [];
  for (const [column, value] of Object.entries(record)) {
    const cur = priceColumnCurrency(column);
    if (!cur || cur === currency || !value?.trim()) continue;
    const amount = parseImportPrice(value);
    if (amount === null || amount < 0) {
      return { ok: false, error: `Precio en ${cur} no válido: "${value}"` };
    }
    if (!prices.some((p) => p.currency === cur)) prices.push({ currency: cur, amount });
  }

  const rawImage = get("imageUrl");
  const imageUrl = rawImage
    ? /^https?:\/\//i.test(rawImage)
      ? rawImage
      : `https://${rawImage}`
    : null;

  const parsed = productImportRowSchema.safeParse({
    name,
    sku: get("sku") || null,
    description: get("description") || null,
    price,
    currency,
    prices,
    imageUrl,
    isActive: parseImportBoolean(get("isActive")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Fila no válida" };
  }
  return { ok: true, value: parsed.data };
}

export const importProductsSchema = z.object({
  rows: z.array(productImportRowSchema).min(1).max(2000),
  /** Si el SKU ya existe: actualizar el producto en vez de saltarlo. */
  updateExisting: z.boolean().default(true),
});
export type ImportProductsInput = z.infer<typeof importProductsSchema>;

export const importProductsResultSchema = z.object({
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
  errors: z.array(z.object({ row: z.number(), message: z.string() })),
});
export type ImportProductsResult = z.infer<typeof importProductsResultSchema>;
