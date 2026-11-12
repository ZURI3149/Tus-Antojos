import { Injectable } from '@nestjs/common';
import type { CreateUser, UpdateUser, User } from '@tus-antojos/shared';
import type { Tables } from '@tus-antojos/shared';
import { UserDirectory } from '../../auth/user-directory.service.js';
import { AppException } from '../../common/app-exception.js';
import { mapRpcError } from '../../common/rpc-error.js';
import { SupabaseService } from '../../supabase/supabase.service.js';

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: Tables<'profiles'>['role'];
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

const BUSINESS_MESSAGES: Record<string, string> = {
  LAST_ADMIN: 'Debe quedar al menos un administrador activo',
  SELF_MODIFICATION: 'No puedes cambiar tu propio rol ni desactivarte',
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: new Date(row.created_at).toISOString(),
    lastSignInAt: row.last_sign_in_at ? new Date(row.last_sign_in_at).toISOString() : null,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly directory: UserDirectory,
  ) {}

  async list(): Promise<User[]> {
    const { data, error } = await this.supabase.admin.rpc('admin_list_users', {});
    if (error) throw mapRpcError(error);
    return (data as UserRow[]).map(toUser);
  }

  async get(userId: string): Promise<User> {
    const { data, error } = await this.supabase.admin.rpc('admin_list_users', {
      p_user_id: userId,
    });
    if (error) throw mapRpcError(error);
    const row = (data as UserRow[])[0];
    if (!row) throw new AppException('NOT_FOUND', 'Usuario no encontrado');
    return toUser(row);
  }

  /** Crea el usuario en Auth; el trigger de la BD crea su perfil en la misma transacción. */
  async create(input: CreateUser): Promise<User> {
    const { data, error } = await this.supabase.admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { role: input.role },
      user_metadata: { full_name: input.fullName },
    });

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === 'email_exists' || code === 'user_already_exists') {
        throw new AppException('CONFLICT', 'Ya existe un usuario con ese correo', undefined, {
          cause: error,
        });
      }
      if (code === 'weak_password') {
        throw new AppException(
          'VALIDATION_ERROR',
          undefined,
          [{ path: 'password', message: 'La contraseña es demasiado débil' }],
          { cause: error },
        );
      }
      throw new AppException('INTERNAL', undefined, undefined, { cause: error });
    }

    return this.get(data.user.id);
  }

  async update(userId: string, input: UpdateUser, actorId: string): Promise<User> {
    // Un admin no puede bloquearse a sí mismo; cambiar su nombre sí.
    if (userId === actorId && (input.role !== undefined || input.isActive === false)) {
      throw new AppException('BUSINESS_RULE', BUSINESS_MESSAGES.SELF_MODIFICATION, {
        reason: 'SELF_MODIFICATION',
      });
    }

    const { error } = await this.supabase.admin.rpc('admin_update_user', {
      p_user_id: userId,
      p_role: input.role,
      p_is_active: input.isActive,
      p_full_name: input.fullName,
    });

    if (error) {
      if (error.code === 'P0001' && error.message === 'USER_NOT_FOUND') {
        throw new AppException('NOT_FOUND', 'Usuario no encontrado', undefined, { cause: error });
      }
      const mapped = mapRpcError(error);
      const reason = (mapped.details as { reason?: string } | undefined)?.reason;
      const message = reason ? BUSINESS_MESSAGES[reason] : undefined;
      throw message
        ? new AppException(mapped.code, message, mapped.details, { cause: error })
        : mapped;
    }

    // La API vuelve a leer el perfil en la próxima petición de ese usuario.
    this.directory.invalidate(userId);
    return this.get(userId);
  }
}
