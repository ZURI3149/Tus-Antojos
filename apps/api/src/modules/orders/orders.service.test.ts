import type { PostgrestError } from '@supabase/supabase-js';
import type { CreateOrder, Order } from '@tus-antojos/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../auth/auth-user.js';
import type { SupabaseService } from '../../supabase/supabase.service.js';
import { OrdersService } from './orders.service.js';

const CASHIER_ID = '00000000-0000-4000-a000-000000000001';
const ORDER_ID = '11111111-1111-4000-a000-000000000001';
const CLIENT_ORDER_ID = '22222222-2222-4000-a000-000000000002';
const PROD_ID = '33333333-3333-4000-a000-000000000003';

const cashierUser: AuthUser = {
  id: CASHIER_ID,
  email: 'cajero@tusantojos.test',
  role: 'cajero',
};

const kitchenUser: AuthUser = {
  id: '00000000-0000-4000-a000-000000000002',
  email: 'cocina@tusantojos.test',
  role: 'cocina',
};

const pgError = (message: string, code = 'P0001'): PostgrestError =>
  ({ code, message, details: '', hint: '', name: 'PostgrestError' }) as PostgrestError;

function setup(currentOrderStatus: string = 'pendiente') {
  const rpc = vi.fn(
    async (
      fn: string,
      args?: unknown,
    ): Promise<{ data: unknown; error: PostgrestError | null }> => {
      if (fn === 'create_order') {
        return {
          data: {
            id: ORDER_ID,
            clientOrderId: CLIENT_ORDER_ID,
            orderNumber: 1,
            replayed: false,
          },
          error: null,
        };
      }
      if (fn === 'advance_order_status') {
        const to = (args as { p_to_status: string }).p_to_status;
        return {
          data: {
            id: ORDER_ID,
            status: to,
          },
          error: null,
        };
      }
      if (fn === 'cancel_order') {
        return {
          data: {
            id: ORDER_ID,
            status: 'anulado',
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  );

  const maybeSingle = vi.fn(
    async (): Promise<{ data: { status: string } | null; error: PostgrestError | null }> => ({
      data: { status: currentOrderStatus },
      error: null,
    }),
  );
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  const supabase = {
    admin: { rpc, from },
  } as unknown as SupabaseService;

  return { service: new OrdersService(supabase), rpc, from, select, eq, maybeSingle };
}

describe('OrdersService', () => {
  let s: ReturnType<typeof setup>;

  beforeEach(() => {
    s = setup('pendiente');
  });

  describe('create', () => {
    const input: CreateOrder = {
      clientOrderId: CLIENT_ORDER_ID,
      items: [{ productId: PROD_ID, quantity: 2, note: '' }],
      paymentMethod: 'efectivo',
    };

    it('llama a create_order con los parámetros mapeados', async () => {
      const res = await s.service.create(input, CASHIER_ID);
      expect(s.rpc).toHaveBeenCalledWith('create_order', {
        p_client_order_id: CLIENT_ORDER_ID,
        p_items: input.items,
        p_payment_method: 'efectivo',
        p_cashier_id: CASHIER_ID,
        p_created_offline_at: undefined,
      });
      expect(res.id).toBe(ORDER_ID);
      expect(res.replayed).toBe(false);
    });

    it('traduce errores de la BD con ordersError', async () => {
      s.rpc.mockResolvedValueOnce({
        data: null,
        error: pgError('IDEMPOTENCY_KEY_REUSED'),
      });

      await expect(s.service.create(input, CASHIER_ID)).rejects.toMatchObject({
        code: 'CONFLICT',
        status: 409,
      });
    });
  });

  describe('advanceStatus', () => {
    it('permite a cocina avanzar de pendiente a en_preparacion', async () => {
      s = setup('pendiente');
      const res = await s.service.advanceStatus(ORDER_ID, 'en_preparacion', kitchenUser);
      expect(s.rpc).toHaveBeenCalledWith('advance_order_status', {
        p_order_id: ORDER_ID,
        p_to_status: 'en_preparacion',
        p_user_id: kitchenUser.id,
      });
      expect((res as Order).status).toBe('en_preparacion');
    });

    it('rechaza a cajero si intenta avanzar a en_preparacion con FORBIDDEN (403)', async () => {
      s = setup('pendiente');
      await expect(
        s.service.advanceStatus(ORDER_ID, 'en_preparacion', cashierUser),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        status: 403,
      });
      expect(s.rpc).not.toHaveBeenCalled();
    });

    it('responde 404 NOT_FOUND si el pedido no existe', async () => {
      s.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(
        s.service.advanceStatus(ORDER_ID, 'en_preparacion', kitchenUser),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    });

    it('no disfraza un fallo de la BD como 404', async () => {
      s.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: {
          code: '08006',
          message: 'connection failure',
          details: '',
          hint: '',
        } as PostgrestError,
      });
      await expect(
        s.service.advanceStatus(ORDER_ID, 'en_preparacion', kitchenUser),
      ).rejects.toMatchObject({ code: 'INTERNAL', status: 500 });
      expect(s.rpc).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('pasa p_only_cashier cuando el usuario es cajero', async () => {
      await s.service.cancel(ORDER_ID, 'Cliente se fue', cashierUser);
      expect(s.rpc).toHaveBeenCalledWith('cancel_order', {
        p_order_id: ORDER_ID,
        p_reason: 'Cliente se fue',
        p_user_id: cashierUser.id,
        p_only_cashier: cashierUser.id,
      });
    });
  });
});
