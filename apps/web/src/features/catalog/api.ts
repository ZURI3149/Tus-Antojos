import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Category,
  CreateCategory,
  CreateIngredient,
  Ingredient,
  UpdateCategory,
  UpdateIngredient,
} from '@tus-antojos/shared';
import { toast } from 'sonner';
import type { ApiError } from '@/lib/api-client';
import { useApi } from '@/lib/api-context';
import { notifyError } from '@/lib/notify-error';
import { useCatalogReader } from './reader';

/** Claves de caché del catálogo. Toda escritura invalida `all` (los datos se cruzan). */
export const catalogKeys = {
  all: ['catalog'] as const,
  categories: ['catalog', 'categories'] as const,
  ingredients: ['catalog', 'ingredients'] as const,
  products: ['catalog', 'products'] as const,
};

/** Mensaje de un error del catálogo, con el contexto que devuelve la BD. */
export function describeCatalogError(error: ApiError): string {
  const context = (error.details as { context?: Record<string, unknown> } | undefined)?.context;
  if (error.reason === 'INGREDIENT_IN_USE' && Array.isArray(context?.products)) {
    return `${error.message}: ${context.products.join(', ')}`;
  }
  if (error.reason === 'CATEGORY_IN_USE' && typeof context?.activeProducts === 'number') {
    const n = context.activeProducts;
    return `${error.message} (${n} ${n === 1 ? 'producto' : 'productos'})`;
  }
  return error.message;
}

export const notifyCatalogError = (error: unknown) => notifyError(error, describeCatalogError);

function useInvalidateCatalog() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: catalogKeys.all });
}

// --- Categorías ---------------------------------------------------------------

export function useCategories() {
  const reader = useCatalogReader();
  return useQuery({ queryKey: catalogKeys.categories, queryFn: () => reader.categories() });
}

export function useCreateCategory() {
  const api = useApi();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (input: CreateCategory) => api.post<Category>('/categories', input),
    onSuccess: () => toast.success('Categoría creada'),
    onSettled: invalidate,
  });
}

export function useUpdateCategory() {
  const api = useApi();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateCategory }) =>
      api.patch<Category>(`/categories/${id}`, changes),
    onSuccess: () => toast.success('Categoría actualizada'),
    onSettled: invalidate,
  });
}

// --- Insumos ------------------------------------------------------------------

export function useIngredients() {
  const reader = useCatalogReader();
  return useQuery({ queryKey: catalogKeys.ingredients, queryFn: () => reader.ingredients() });
}

export function useCreateIngredient() {
  const api = useApi();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (input: CreateIngredient) => api.post<Ingredient>('/ingredients', input),
    onSuccess: () => toast.success('Insumo creado'),
    onSettled: invalidate,
  });
}

export function useUpdateIngredient() {
  const api = useApi();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateIngredient }) =>
      api.patch<Ingredient>(`/ingredients/${id}`, changes),
    onSuccess: () => toast.success('Insumo actualizado'),
    onSettled: invalidate,
  });
}

// --- Productos ----------------------------------------------------------------

export function useProducts() {
  const reader = useCatalogReader();
  return useQuery({ queryKey: catalogKeys.products, queryFn: () => reader.products() });
}
