import type { PostgrestError } from '@supabase/supabase-js';
import type { CreatePromotion, UpdatePromotion } from '@tus-antojos/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/app-exception.js';
import type { SupabaseService } from '../../supabase/supabase.service.js';
import { PromotionsService } from './promotions.service.js';

const ADMIN_ID = '00000000-0000-4000-a000-000000000003';
const PROMO_ID = '11111111-1111-4000-a000-000000000001';
const PRODUCT_ID = '22222222-2222-4000-a000-000000000002';

const pgError = (message: string, code = 'P0001'): PostgrestError =>
  ({ code, message, details: '', hint: '', name: 'PostgrestError' }) as PostgrestError;

function setup() {
  const rpc = vi.fn(
    async (
      fn: string,
      _args?: unknown,
    ): Promise<{ data: string | null; error: PostgrestError | null }> => {
      if (fn === 'create_promotion') {
        return { data: PROMO_ID, error: null };
      }
      if (fn === 'update_promotion') {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  );

  const supabase = {
    admin: { rpc },
  } as unknown as SupabaseService;

  return { service: new PromotionsService(supabase), rpc };
}

async function caught(promise: Promise<unknown>): Promise<AppException> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppException);
  return error as AppException;
}

describe('PromotionsService', () => {
  let s: ReturnType<typeof setup>;

  beforeEach(() => {
    s = setup();
  });

  describe('create', () => {
    const input: CreatePromotion = {
      name: 'Verano 2026',
      kind: 'porcentaje',
      value: 20,
      startsAt: '2026-06-01T00:00:00.000Z',
      endsAt: '2026-06-30T23:59:59.000Z',
      productIds: [PRODUCT_ID],
    };

    it('llama a create_promotion con los parámetros mapeados y devuelve el id', async () => {
      const result = await s.service.create(input, ADMIN_ID);
      expect(result).toEqual({ id: PROMO_ID });
      expect(s.rpc).toHaveBeenCalledWith('create_promotion', {
        p_name: input.name,
        p_kind: input.kind,
        p_value: input.value,
        p_starts_at: input.startsAt,
        p_ends_at: input.endsAt,
        p_product_ids: input.productIds,
        p_user_id: ADMIN_ID,
      });
    });

    it('maneja endsAt nulo pasando undefined al RPC', async () => {
      await s.service.create({ ...input, endsAt: null }, ADMIN_ID);
      expect(s.rpc).toHaveBeenCalledWith('create_promotion', {
        p_name: input.name,
        p_kind: input.kind,
        p_value: input.value,
        p_starts_at: input.startsAt,
        p_ends_at: undefined,
        p_product_ids: input.productIds,
        p_user_id: ADMIN_ID,
      });
    });

    it('traduce errores mediante promotionsError', async () => {
      s.rpc.mockResolvedValueOnce({ data: null, error: pgError('PROMOTION_NAME_TAKEN') });
      const err = await caught(s.service.create(input, ADMIN_ID));
      expect(err.code).toBe('CONFLICT');
      expect(err.message).toBe('Ya existe una promoción activa con este nombre');
    });
  });

  describe('update', () => {
    it('llama a update_promotion con los cambios en camelCase convertidos a snake_case', async () => {
      const input: UpdatePromotion = {
        name: 'Verano Renovado',
        value: 25,
        isActive: false,
      };

      const result = await s.service.update(PROMO_ID, input);
      expect(result).toEqual({ id: PROMO_ID });
      expect(s.rpc).toHaveBeenCalledWith('update_promotion', {
        p_id: PROMO_ID,
        p_changes: {
          name: 'Verano Renovado',
          value: 25,
          is_active: false,
        },
        p_product_ids: undefined,
      });
    });

    it('pasa p_product_ids cuando vienen en el input', async () => {
      const input: UpdatePromotion = {
        productIds: [PRODUCT_ID],
      };

      await s.service.update(PROMO_ID, input);
      expect(s.rpc).toHaveBeenCalledWith('update_promotion', {
        p_id: PROMO_ID,
        p_changes: {},
        p_product_ids: [PRODUCT_ID],
      });
    });

    it('permite quitar la fecha de fin asignando ends_at: null', async () => {
      const input: UpdatePromotion = {
        endsAt: null,
      };

      await s.service.update(PROMO_ID, input);
      expect(s.rpc).toHaveBeenCalledWith('update_promotion', {
        p_id: PROMO_ID,
        p_changes: {
          ends_at: null,
        },
        p_product_ids: undefined,
      });
    });

    it('traduce PROMOTION_NOT_FOUND a NOT_FOUND', async () => {
      s.rpc.mockResolvedValueOnce({ data: null, error: pgError('PROMOTION_NOT_FOUND') });
      const err = await caught(s.service.update(PROMO_ID, { name: 'Otro' }));
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Promoción no encontrada');
    });
  });
});
