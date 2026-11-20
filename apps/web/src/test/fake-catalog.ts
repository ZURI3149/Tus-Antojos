import type {
  Category,
  CreateCategory,
  CreateIngredient,
  CreateProduct,
  Ingredient,
  Product,
  UpdateCategory,
  UpdateIngredient,
  UpdateProduct,
} from '@tus-antojos/shared';
import {
  catalogRuleMessage,
  createProductSchema,
  PRODUCT_IMAGE_PATH,
  setRecipeSchema,
} from '@tus-antojos/shared';
import type { ProductImageStorage } from '@/features/catalog/images';
import type { CatalogReader } from '@/features/catalog/reader';
import { ApiError } from '@/lib/api-client';

const NOW = '2026-11-17T10:00:00.000Z';

/** Marca que la ruta no es del catálogo (la API falsa sigue buscando). */
export const NOT_HANDLED = Symbol('NOT_HANDLED');

export interface CatalogData {
  categories: Category[];
  ingredients: Ingredient[];
  products: Product[];
}

export function seedCatalog(): CatalogData {
  const helados: Category = {
    id: '00000000-0000-4000-8000-0000000000c1',
    name: 'Helados',
    sortOrder: 1,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const bebidas: Category = {
    ...helados,
    id: '00000000-0000-4000-8000-0000000000c2',
    name: 'Bebidas',
    sortOrder: 2,
  };
  const leche: Ingredient = {
    id: '00000000-0000-4000-8000-0000000000e1',
    name: 'Leche',
    unit: 'ml',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
  /** Sin recetas: se puede cambiar su unidad y desactivar. */
  const azucar: Ingredient = {
    ...leche,
    id: '00000000-0000-4000-8000-0000000000e2',
    name: 'Azúcar',
    unit: 'g',
  };
  const cono: Product = {
    id: '00000000-0000-4000-8000-0000000000f1',
    categoryId: helados.id,
    name: 'Cono simple',
    description: '',
    priceCents: 1000,
    imagePath: null,
    isActive: true,
    recipe: [{ ingredientId: leche.id, quantity: 100 }],
    createdAt: NOW,
    updatedAt: NOW,
  };
  /** Inactivo: no se ofrece en las recetas. */
  const chocolate: Ingredient = {
    ...leche,
    id: '00000000-0000-4000-8000-0000000000e3',
    name: 'Chocolate',
    unit: 'g',
    isActive: false,
  };
  /** Inactivo y sin receta: no se puede activar. */
  const malteada: Product = {
    ...cono,
    id: '00000000-0000-4000-8000-0000000000f2',
    categoryId: bebidas.id,
    name: 'Malteada',
    description: 'De vainilla',
    priceCents: 1850,
    isActive: false,
    recipe: [],
  };
  /** Inactiva: no se ofrece al elegir la categoría de un producto. */
  const temporada: Category = {
    ...helados,
    id: '00000000-0000-4000-8000-0000000000c3',
    name: 'Temporada',
    sortOrder: 3,
    isActive: false,
  };
  return {
    categories: [helados, bebidas, temporada],
    ingredients: [leche, azucar, chocolate],
    products: [cono, malteada],
  };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function conflict(message: string) {
  return new ApiError(409, 'CONFLICT', message, undefined, 'r');
}

function rule(reason: string, context?: Record<string, unknown>) {
  return new ApiError(
    422,
    'BUSINESS_RULE',
    catalogRuleMessage(reason) ?? reason,
    context ? { reason, context } : { reason },
    'r',
  );
}

/**
 * Catálogo en memoria: lecturas (como Supabase) y escrituras (como la API),
 * sobre los mismos datos y con las reglas principales de la BD.
 */
export function createFakeCatalog(data: CatalogData = seedCatalog()) {
  const reader: CatalogReader = {
    categories: async () =>
      structuredClone(
        [...data.categories].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
      ),
    ingredients: async () =>
      structuredClone([...data.ingredients].sort((a, b) => a.name.localeCompare(b.name))),
    products: async () =>
      structuredClone([...data.products].sort((a, b) => a.name.localeCompare(b.name))),
  };

  function handle(method: string, path: string, body: unknown): unknown {
    if (method === 'POST' && path === '/categories') {
      const input = body as CreateCategory;
      if (data.categories.some((c) => sameName(c.name, input.name))) {
        throw conflict('Ya existe una categoría con ese nombre');
      }
      const category: Category = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: NOW,
        updatedAt: NOW,
      };
      data.categories.push(category);
      return structuredClone(category);
    }

    const category = path.match(/^\/categories\/(.+)$/);
    if (method === 'PATCH' && category) {
      const target = data.categories.find((c) => c.id === category[1]);
      if (!target) throw new ApiError(404, 'NOT_FOUND', 'Categoría no encontrada', undefined, 'r');
      const changes = body as UpdateCategory;
      if (
        changes.name &&
        data.categories.some((c) => c.id !== target.id && sameName(c.name, changes.name!))
      ) {
        throw conflict('Ya existe una categoría con ese nombre');
      }
      if (changes.isActive === false && target.isActive) {
        const activeProducts = data.products.filter(
          (p) => p.categoryId === target.id && p.isActive,
        ).length;
        if (activeProducts > 0) throw rule('CATEGORY_IN_USE', { activeProducts });
      }
      Object.assign(target, changes);
      return structuredClone(target);
    }

    if (method === 'POST' && path === '/ingredients') {
      const input = body as CreateIngredient;
      if (data.ingredients.some((i) => sameName(i.name, input.name))) {
        throw conflict('Ya existe un insumo con ese nombre');
      }
      const ingredient: Ingredient = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: NOW,
        updatedAt: NOW,
      };
      data.ingredients.push(ingredient);
      return structuredClone(ingredient);
    }

    const ingredient = path.match(/^\/ingredients\/(.+)$/);
    if (method === 'PATCH' && ingredient) {
      const target = data.ingredients.find((i) => i.id === ingredient[1]);
      if (!target) throw new ApiError(404, 'NOT_FOUND', 'Insumo no encontrado', undefined, 'r');
      const changes = body as UpdateIngredient;
      const usedBy = data.products.filter((p) =>
        p.recipe.some((item) => item.ingredientId === target.id),
      );
      if (
        changes.name &&
        data.ingredients.some((i) => i.id !== target.id && sameName(i.name, changes.name!))
      ) {
        throw conflict('Ya existe un insumo con ese nombre');
      }
      if (changes.unit && changes.unit !== target.unit && usedBy.length > 0) {
        throw rule('INGREDIENT_UNIT_LOCKED');
      }
      if (changes.isActive === false && target.isActive) {
        const products = usedBy.filter((p) => p.isActive).map((p) => p.name);
        if (products.length > 0) throw rule('INGREDIENT_IN_USE', { products });
      }
      Object.assign(target, changes);
      return structuredClone(target);
    }

    if (method === 'POST' && path === '/products') {
      // Como el ZodValidationPipe de la API: aplica los valores por defecto (inactivo, sin receta).
      const input: CreateProduct = createProductSchema.parse(body);
      if (data.products.some((p) => sameName(p.name, input.name))) {
        throw conflict('Ya existe un producto con ese nombre');
      }
      const product: Product = {
        id: crypto.randomUUID(),
        ...input,
        imagePath: null,
        createdAt: NOW,
        updatedAt: NOW,
      };
      if (product.recipe.some((item) => inactiveIngredient(item.ingredientId))) {
        throw rule('INGREDIENT_INACTIVE');
      }
      checkProductRules(product);
      data.products.push(product);
      return structuredClone(product);
    }

    const product = path.match(/^\/products\/([^/]+)$/);
    if (method === 'PATCH' && product) {
      const target = data.products.find((p) => p.id === product[1]);
      if (!target) throw new ApiError(404, 'NOT_FOUND', 'Producto no encontrado', undefined, 'r');
      const changes = body as UpdateProduct;
      if (
        changes.name &&
        data.products.some((p) => p.id !== target.id && sameName(p.name, changes.name!))
      ) {
        throw conflict('Ya existe un producto con ese nombre');
      }
      checkProductRules({ ...target, ...changes });
      Object.assign(target, changes);
      return structuredClone(target);
    }

    const recipe = path.match(/^\/products\/([^/]+)\/recipe$/);
    if (method === 'PUT' && recipe) {
      const target = data.products.find((p) => p.id === recipe[1]);
      if (!target) throw rule('PRODUCT_NOT_FOUND');
      const { items } = setRecipeSchema.parse(body);
      if (items.some((item) => inactiveIngredient(item.ingredientId))) {
        throw rule('INGREDIENT_INACTIVE');
      }
      checkProductRules({ ...target, recipe: items });
      target.recipe = items;
      return structuredClone(target);
    }

    const imageUpload = path.match(/^\/products\/([^/]+)\/image-upload$/);
    if (method === 'POST' && imageUpload) {
      findProduct(imageUpload[1]!);
      const target = `products/${imageUpload[1]}/${crypto.randomUUID()}.webp`;
      return {
        path: target,
        token: `token-${target}`,
        signedUrl: `https://storage.test/${target}`,
      };
    }

    const image = path.match(/^\/products\/([^/]+)\/image$/);
    if (method === 'PUT' && image) {
      const target = findProduct(image[1]!);
      const { path: imagePath } = body as { path: string };
      if (PRODUCT_IMAGE_PATH.exec(imagePath)?.[1] !== target.id) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'La imagen no pertenece a este producto',
          undefined,
          'r',
        );
      }
      if (!files.has(imagePath)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'La imagen no se subió', undefined, 'r');
      }
      for (const file of files)
        if (file.startsWith(`products/${target.id}/`) && file !== imagePath) files.delete(file);
      target.imagePath = imagePath;
      return structuredClone(target);
    }
    if (method === 'DELETE' && image) {
      const target = findProduct(image[1]!);
      for (const file of files) if (file.startsWith(`products/${target.id}/`)) files.delete(file);
      target.imagePath = null;
      return structuredClone(target);
    }

    return NOT_HANDLED;
  }

  function findProduct(id: string): Product {
    const product = data.products.find((p) => p.id === id);
    if (!product) throw new ApiError(404, 'NOT_FOUND', 'Producto no encontrado', undefined, 'r');
    return product;
  }

  /** Archivos del bucket (rutas). Subir solo se puede a una ruta emitida por la API. */
  const files = new Set<string>();
  const images: ProductImageStorage = {
    publicUrl: (path) => `https://storage.test/${path}`,
    upload: async (target, file) => {
      if (target.token !== `token-${target.path}`) throw new Error('No se pudo subir la foto');
      if (file.type !== 'image/webp') throw new Error('No se pudo subir la foto');
      files.add(target.path);
    },
  };

  const inactiveIngredient = (id: string) => !data.ingredients.find((i) => i.id === id)?.isActive;

  /** Reglas de un producto activo (triggers de la BD). */
  function checkProductRules(product: Product) {
    if (!product.isActive) return;
    if (product.recipe.length === 0) throw rule('PRODUCT_WITHOUT_RECIPE');
    if (product.recipe.some((item) => inactiveIngredient(item.ingredientId))) {
      throw rule('INGREDIENT_INACTIVE');
    }
    if (!data.categories.find((c) => c.id === product.categoryId)?.isActive) {
      throw rule('CATEGORY_INACTIVE');
    }
  }

  return { reader, images, files, handle, data };
}

export type FakeCatalog = ReturnType<typeof createFakeCatalog>;
