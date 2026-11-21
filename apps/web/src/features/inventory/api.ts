import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  inventoryRuleMessage,
  type CountStockInput,
  type InventoryMovement,
  type InventoryRule,
  type RecordWasteInput,
  type RegisterPurchaseInput,
  type StockItem,
  type UpdateStockInput,
} from '@tus-antojos/shared';
import { toast } from 'sonner';
import type { ApiError } from '@/lib/api-client';
import { useApi } from '@/lib/api-context';
import { notifyError } from '@/lib/notify-error';
import { useInventoryReader } from './reader';

export const inventoryKeys = {
  all: ['inventory'] as const,
  stock: ['inventory', 'stock'] as const,
  kardex: (ingredientId: string) => ['inventory', 'kardex', ingredientId] as const,
  purchases: ['inventory', 'purchases'] as const,
  ingredient: (id: string) => ['inventory', 'ingredient', id] as const,
};

export function describeInventoryError(error: ApiError): string {
  const reason = error.reason as InventoryRule | undefined;
  if (reason) {
    const msg = inventoryRuleMessage(reason);
    if (msg) return msg;
  }
  return error.message;
}

export const notifyInventoryError = (error: unknown) => notifyError(error, describeInventoryError);

function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
}

export function useStock() {
  const reader = useInventoryReader();
  return useQuery({
    queryKey: inventoryKeys.stock,
    queryFn: () => reader.stock(),
  });
}

export function useKardex(ingredientId: string, limit = 50) {
  const reader = useInventoryReader();
  return useQuery({
    queryKey: [...inventoryKeys.kardex(ingredientId), limit],
    queryFn: () => reader.kardex(ingredientId, limit),
    enabled: Boolean(ingredientId),
  });
}

export function usePurchases(limit = 50) {
  const reader = useInventoryReader();
  return useQuery({
    queryKey: [...inventoryKeys.purchases, limit],
    queryFn: () => reader.purchases(limit),
    placeholderData: keepPreviousData,
  });
}

export function useInventoryIngredient(id: string) {
  const reader = useInventoryReader();
  return useQuery({
    queryKey: inventoryKeys.ingredient(id),
    queryFn: () => reader.ingredient(id),
    enabled: Boolean(id),
  });
}

export function useUpdateStock() {
  const api = useApi();
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ ingredientId, changes }: { ingredientId: string; changes: UpdateStockInput }) =>
      api.patch<StockItem>(`/inventory/stock/${ingredientId}`, changes),
    onSuccess: () => toast.success('Stock mínimo actualizado'),
    onSettled: invalidate,
  });
}

export function useRegisterPurchase() {
  const api = useApi();
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (input: RegisterPurchaseInput) =>
      api.post<{ id: string }>('/inventory/purchases', input),
    onSuccess: () => toast.success('Compra registrada correctamente'),
    onSettled: invalidate,
  });
}

export function useRecordWaste() {
  const api = useApi();
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (input: RecordWasteInput) => api.post<InventoryMovement>('/inventory/waste', input),
    onSuccess: () => toast.success('Merma registrada correctamente'),
    onSettled: invalidate,
  });
}

export function useCountStock() {
  const api = useApi();
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (input: CountStockInput) => api.post<InventoryMovement>('/inventory/counts', input),
    onSuccess: () => toast.success('Conteo físico registrado correctamente'),
    onSettled: invalidate,
  });
}
