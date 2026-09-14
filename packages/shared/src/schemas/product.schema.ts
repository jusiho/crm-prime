import { z } from "zod";

export const productDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  description: z.string().nullable(),
  price: z.number(),
  currency: z.string(),
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
  imageUrl: imageUrlField.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
