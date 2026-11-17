import { z } from 'zod';
import { ingredientUnitSchema } from './units';

/** Contratos del catálogo (spec catalog §4.1). Dinero en centavos y cantidades en unidad base. */

const AT_LEAST_ONE_CHANGE = { error: 'Indica al menos un cambio' };
const hasChanges = (v: Record<string, unknown>) => Object.values(v).some((x) => x !== undefined);

export const catalogNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Ingresa el nombre' })
  .max(80, { error: 'Máximo 80 caracteres' });

const timestamps = { createdAt: z.string(), updatedAt: z.string() };

// --- Categorías ---------------------------------------------------------------

const sortOrder = z
  .number()
  .int({ error: 'Debe ser un número entero' })
  .min(0, { error: 'Mínimo 0' })
  .max(9999, { error: 'Máximo 9999' });

export const createCategorySchema = z.object({
  name: catalogNameSchema,
  sortOrder: sortOrder.default(0),
  isActive: z.boolean().default(true),
});
export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type CreateCategory = z.output<typeof createCategorySchema>;

export const updateCategorySchema = z
  .strictObject({
    name: catalogNameSchema.optional(),
    sortOrder: sortOrder.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(hasChanges, AT_LEAST_ONE_CHANGE);
export type UpdateCategory = z.output<typeof updateCategorySchema>;

export const categorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  ...timestamps,
});
export type Category = z.infer<typeof categorySchema>;

// --- Insumos ------------------------------------------------------------------

export const createIngredientSchema = z.object({
  name: catalogNameSchema,
  unit: ingredientUnitSchema,
  isActive: z.boolean().default(true),
});
export type CreateIngredientInput = z.input<typeof createIngredientSchema>;
export type CreateIngredient = z.output<typeof createIngredientSchema>;

export const updateIngredientSchema = z
  .strictObject({
    name: catalogNameSchema.optional(),
    unit: ingredientUnitSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(hasChanges, AT_LEAST_ONE_CHANGE);
export type UpdateIngredient = z.output<typeof updateIngredientSchema>;

export const ingredientSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  unit: ingredientUnitSchema,
  isActive: z.boolean(),
  ...timestamps,
});
export type Ingredient = z.infer<typeof ingredientSchema>;

// --- Recetas ------------------------------------------------------------------

export const MAX_RECIPE_ITEMS = 30;

export const recipeItemSchema = z.object({
  ingredientId: z.uuid({ error: 'Elige un insumo' }),
  quantity: z
    .number()
    .int({ error: 'La cantidad debe ser entera en la unidad base' })
    .positive({ error: 'La cantidad debe ser mayor a 0' })
    .max(1_000_000, { error: 'Cantidad demasiado grande' }),
});
export type RecipeItem = z.infer<typeof recipeItemSchema>;

export const recipeSchema = z
  .array(recipeItemSchema)
  .max(MAX_RECIPE_ITEMS, { error: `Máximo ${MAX_RECIPE_ITEMS} insumos por receta` })
  .refine((items) => new Set(items.map((i) => i.ingredientId)).size === items.length, {
    error: 'Un insumo aparece dos veces en la receta',
  });

export const setRecipeSchema = z.object({ items: recipeSchema });
export type SetRecipe = z.infer<typeof setRecipeSchema>;

// --- Productos ----------------------------------------------------------------

const description = z.string().trim().max(500, { error: 'Máximo 500 caracteres' });
const priceCents = z
  .number()
  .int({ error: 'El precio debe estar en centavos enteros' })
  .positive({ error: 'El precio debe ser mayor a 0' })
  .max(100_000_000, { error: 'Precio demasiado alto' });
const categoryId = z.uuid({ error: 'Elige una categoría' });

export const createProductSchema = z.object({
  categoryId,
  name: catalogNameSchema,
  description: description.default(''),
  priceCents,
  isActive: z.boolean().default(false),
  recipe: recipeSchema.default([]),
});
export type CreateProductInput = z.input<typeof createProductSchema>;
export type CreateProduct = z.output<typeof createProductSchema>;

/** La receta y la foto se editan por separado (`PUT /products/:id/recipe` y `/image`). */
export const updateProductSchema = z
  .strictObject({
    categoryId: categoryId.optional(),
    name: catalogNameSchema.optional(),
    description: description.optional(),
    priceCents: priceCents.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(hasChanges, AT_LEAST_ONE_CHANGE);
export type UpdateProduct = z.output<typeof updateProductSchema>;

export const productSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  name: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  imagePath: z.string().nullable(),
  isActive: z.boolean(),
  recipe: z.array(recipeItemSchema),
  ...timestamps,
});
export type Product = z.infer<typeof productSchema>;

// --- Foto del producto (spec catalog D3) --------------------------------------

export const PRODUCT_IMAGE_BUCKET = 'product-images';
export const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_DIMENSION = 800;
export const PRODUCT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** products/<productId>/<uuid>.webp */
export const PRODUCT_IMAGE_PATH = new RegExp(`^products/(${UUID})/${UUID}\\.webp$`);

/** URL firmada para subir la foto directamente a Storage. */
export const productImageUploadSchema = z.object({
  path: z.string(),
  token: z.string(),
  signedUrl: z.string(),
});
export type ProductImageUpload = z.infer<typeof productImageUploadSchema>;

export const confirmProductImageSchema = z.object({
  path: z.string().regex(PRODUCT_IMAGE_PATH, { error: 'Ruta de imagen inválida' }),
});
export type ConfirmProductImage = z.infer<typeof confirmProductImageSchema>;
