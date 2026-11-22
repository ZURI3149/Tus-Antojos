import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  promotionRuleMessage,
  type CreatePromotion,
  type PromotionRule,
  type UpdatePromotion,
} from '@tus-antojos/shared';
import type { ApiClient, ApiError } from '@/lib/api-client';
import { useApi } from '@/lib/api-context';
import { notifyError } from '@/lib/notify-error';
import { usePromotionsReader } from './reader';

export const promotionKeys = {
  all: ['promotions'] as const,
  list: () => ['promotions', 'list'] as const,
  detail: (id: string) => ['promotions', 'detail', id] as const,
};

export function describePromotionError(error: ApiError): string {
  const reason = error.reason as PromotionRule | undefined;
  if (reason) {
    const msg = promotionRuleMessage(reason);
    if (msg) return msg;
  }
  return error.message;
}

export const notifyPromotionError = (error: unknown) => notifyError(error, describePromotionError);

export function usePromotions() {
  const reader = usePromotionsReader();
  return useQuery({
    queryKey: promotionKeys.list(),
    queryFn: () => reader.promotions(),
  });
}

export function usePromotion(id: string) {
  const reader = usePromotionsReader();
  return useQuery({
    queryKey: promotionKeys.detail(id),
    queryFn: () => reader.promotion(id),
    enabled: Boolean(id),
  });
}

export async function createPromotion(
  api: ApiClient,
  input: CreatePromotion,
): Promise<{ id: string }> {
  return api.post<{ id: string }>('/promotions', input);
}

export async function updatePromotion(
  api: ApiClient,
  id: string,
  input: UpdatePromotion,
): Promise<{ id: string }> {
  return api.patch<{ id: string }>(`/promotions/${id}`, input);
}

export function useCreatePromotion() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePromotion) => createPromotion(api, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: promotionKeys.all }),
  });
}

export function useUpdatePromotion() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdatePromotion }) =>
      updatePromotion(api, id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: promotionKeys.all }),
  });
}
