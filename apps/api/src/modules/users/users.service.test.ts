import { PostgrestError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/app-exception.js';
import type { UserDirectory } from '../../auth/user-directory.service.js';
import type { SupabaseService } from '../../supabase/supabase.service.js';
import { UsersService } from './users.service.js';

const ADMIN_ID = '00000000-0000-4000-a000-000000000003';
const USER_ID = '00000000-0000-4000-a000-000000000001';

const row = {
  id: USER_ID,
  email: 'cajero@tusantojos.test',
  full_name: 'Cajero de Prueba',
  role: 'cajero',
  is_active: true,
  created_at: '2026-11-12T10:00:00+00:00',
  last_sign_in_at: null,
};

function setup() {
  const rpc = vi.fn(async (fn: string, _args?: unknown) =>
    fn === 'admin_list_users' ? { data: [row], error: null } : { data: null, error: null },
  );
  const createUser = vi.fn(async (_attrs: unknown) => ({
    data: { user: { id: USER_ID } },
    error: null as unknown,
  }));
  const supabase = {
    admin: { rpc, auth: { admin: { createUser } } },
  } as unknown as SupabaseService;
  const invalidate = vi.fn();
  const directory = { invalidate } as unknown as UserDirectory;
  return { service: new UsersService(supabase, directory), rpc, createUser, invalidate };
}

const pgError = (message: string, code = 'P0001') =>
  new PostgrestError({ message, code, details: '', hint: '' });

async function caught(promise: Promise<unknown>): Promise<AppException> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppException);
  return error as AppException;
}

describe('UsersService', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
  });

  it('list() traduce las filas al formato de la API', async () => {
    await expect(s.service.list()).resolves.toEqual([
      {
        id: USER_ID,
        email: 'cajero@tusantojos.test',
        fullName: 'Cajero de Prueba',
        role: 'cajero',
        isActive: true,
        createdAt: '2026-11-12T10:00:00.000Z',
        lastSignInAt: null,
      },
    ]);
  });

  describe('create()', () => {
    const input = {
      email: 'nuevo@tusantojos.test',
      password: 'clave-segura-1',
      fullName: 'Ana',
      role: 'cajero' as const,
    };

    it('crea en Auth con el rol en app_metadata, correo confirmado y el nombre', async () => {
      await s.service.create(input);
      expect(s.createUser).toHaveBeenCalledWith({
        email: 'nuevo@tusantojos.test',
        password: 'clave-segura-1',
        email_confirm: true,
        app_metadata: { role: 'cajero' },
        user_metadata: { full_name: 'Ana' },
      });
      expect(s.rpc).toHaveBeenCalledWith('admin_list_users', { p_user_id: USER_ID });
    });

    it('correo repetido → 409 CONFLICT', async () => {
      s.createUser.mockResolvedValueOnce({
        data: { user: null } as never,
        error: { name: 'AuthApiError', code: 'email_exists', status: 422, message: 'x' },
      });
      const error = await caught(s.service.create(input));
      expect([error.code, error.message]).toEqual([
        'CONFLICT',
        'Ya existe un usuario con ese correo',
      ]);
    });

    it('contraseña débil según Auth → 400 con el campo password', async () => {
      s.createUser.mockResolvedValueOnce({
        data: { user: null } as never,
        error: { name: 'AuthWeakPasswordError', code: 'weak_password', status: 422, message: 'x' },
      });
      const error = await caught(s.service.create(input));
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual([
        { path: 'password', message: 'La contraseña es demasiado débil' },
      ]);
    });

    it('otro error de Auth → 500 INTERNAL', async () => {
      s.createUser.mockResolvedValueOnce({
        data: { user: null } as never,
        error: { name: 'AuthApiError', code: 'unexpected_failure', status: 500, message: 'x' },
      });
      expect((await caught(s.service.create(input))).code).toBe('INTERNAL');
    });
  });

  describe('update()', () => {
    it('llama al RPC con solo los campos indicados y limpia la caché del usuario', async () => {
      await s.service.update(USER_ID, { role: 'cocina' }, ADMIN_ID);
      expect(s.rpc).toHaveBeenCalledWith('admin_update_user', {
        p_user_id: USER_ID,
        p_role: 'cocina',
        p_is_active: undefined,
        p_full_name: undefined,
      });
      expect(s.invalidate).toHaveBeenCalledWith(USER_ID);
    });

    it.each([{ role: 'cajero' as const }, { isActive: false }])(
      'un admin no puede %j sobre sí mismo (SELF_MODIFICATION) y no se llama al RPC',
      async (change) => {
        const error = await caught(s.service.update(ADMIN_ID, change, ADMIN_ID));
        expect(error.code).toBe('BUSINESS_RULE');
        expect(error.details).toEqual({ reason: 'SELF_MODIFICATION' });
        expect(s.rpc).not.toHaveBeenCalledWith('admin_update_user', expect.anything());
      },
    );

    it('sí puede cambiarse el nombre a sí mismo', async () => {
      await s.service.update(ADMIN_ID, { fullName: 'Nuevo' }, ADMIN_ID);
      expect(s.rpc).toHaveBeenCalledWith(
        'admin_update_user',
        expect.objectContaining({ p_full_name: 'Nuevo' }),
      );
    });

    it('USER_NOT_FOUND → 404', async () => {
      s.rpc.mockResolvedValueOnce({ data: null, error: pgError('USER_NOT_FOUND') } as never);
      const error = await caught(s.service.update(USER_ID, { isActive: false }, ADMIN_ID));
      expect([error.code, error.getStatus()]).toEqual(['NOT_FOUND', 404]);
      expect(s.invalidate).not.toHaveBeenCalled();
    });

    it('LAST_ADMIN → 422 BUSINESS_RULE con un mensaje claro', async () => {
      s.rpc.mockResolvedValueOnce({ data: null, error: pgError('LAST_ADMIN') } as never);
      const error = await caught(s.service.update(USER_ID, { role: 'cajero' }, ADMIN_ID));
      expect(error.code).toBe('BUSINESS_RULE');
      expect(error.details).toEqual({ reason: 'LAST_ADMIN' });
      expect(error.message).toBe('Debe quedar al menos un administrador activo');
    });
  });
});
