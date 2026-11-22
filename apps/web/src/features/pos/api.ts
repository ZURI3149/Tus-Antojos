import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  orderRuleMessage,
  type AdvanceOrderStatusInput,
  type CancelOrderInput,
  type CreateOrderInput,
  type Order,
  type OrderRule,
} from '@tus-antojos/shared';
import type { ApiClient, ApiError, RequestOptions } from '@/lib/api-client';
import { useApi } from '@/lib/api-context';
import { notifyError } from '@/lib/notify-error';
import { useOrdersReader, type OrdersFilter } from './reader';

export const orderKeys = {
  all: ['orders'] as const,
  list: (filters?: OrdersFilter) => ['orders', 'list', filters] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
  events: (id: string) => ['orders', 'events', id] as const,
  movements: (id: string) => ['orders', 'movements', id] as const,
};

export function describeOrderError(error: ApiError): string {
  const reason = error.reason as OrderRule | 'STOCK_INSUFFICIENT' | undefined;
  if (reason === 'STOCK_INSUFFICIENT') {
    return 'Stock insuficiente de ingredientes para este pedido';
  }
  if (reason) {
    const msg = orderRuleMessage(reason as OrderRule);
    if (msg) return msg;
  }
  return error.message;
}

export const notifyOrderError = (error: unknown) => notifyError(error, describeOrderError);

/** Respaldo por si Realtime se cae o no está disponible. */
const LIVE_ORDERS_FALLBACK_POLL_MS = 15_000;

export function useOrders(filters?: OrdersFilter, options?: { live?: boolean }) {
  const reader = useOrdersReader();
  const queryClient = useQueryClient();
  const live = options?.live ?? false;

  // Pantallas operativas (cocina, caja): refrescar en cuanto cambia un pedido.
  useEffect(() => {
    if (!live || !reader.subscribe) return;
    return reader.subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    });
  }, [live, reader, queryClient]);

  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: () => reader.orders(filters),
    refetchInterval: live ? LIVE_ORDERS_FALLBACK_POLL_MS : false,
  });
}

export function useOrder(id: string) {
  const reader = useOrdersReader();
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => reader.order(id),
    enabled: Boolean(id),
  });
}

export function useOrderEvents(orderId: string) {
  const reader = useOrdersReader();
  return useQuery({
    queryKey: orderKeys.events(orderId),
    queryFn: () => reader.events(orderId),
    enabled: Boolean(orderId),
  });
}

export function useOrderMovements(orderId: string) {
  const reader = useOrdersReader();
  return useQuery({
    queryKey: orderKeys.movements(orderId),
    queryFn: () => reader.movements(orderId),
    enabled: Boolean(orderId),
  });
}

export async function createOrder(
  api: ApiClient,
  input: CreateOrderInput,
  options?: RequestOptions,
): Promise<Order> {
  return api.post<Order>('/orders', input, { 'idempotency-key': input.clientOrderId }, options);
}

export async function advanceOrderStatus(
  api: ApiClient,
  id: string,
  input: AdvanceOrderStatusInput,
): Promise<Order> {
  return api.post<Order>(`/orders/${id}/status`, input);
}

export async function cancelOrder(
  api: ApiClient,
  id: string,
  input: CancelOrderInput,
): Promise<Order> {
  return api.post<Order>(`/orders/${id}/cancel`, input);
}

export function useCreateOrder() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(api, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      // El pedido descuenta inventario por kardex
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useAdvanceOrderStatus() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdvanceOrderStatusInput }) =>
      advanceOrderStatus(api, id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}

export function useCancelOrder() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CancelOrderInput }) =>
      cancelOrder(api, id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
