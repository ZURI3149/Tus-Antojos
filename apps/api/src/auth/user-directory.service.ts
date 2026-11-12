import { Injectable } from '@nestjs/common';
import type { AppRole } from '@tus-antojos/shared';
import { SupabaseService } from '../supabase/supabase.service.js';

export interface DirectoryProfile {
  role: AppRole;
  isActive: boolean;
}

/**
 * Rol y estado de cada usuario según `profiles` (la misma fuente que usa RLS),
 * con caché en memoria para no consultar la base en cada petición.
 * Un cambio hecho por la API (T13) llama a invalidate(); un cambio hecho por
 * fuera tarda como máximo TTL_MS en notarse.
 */
@Injectable()
export class UserDirectory {
  static readonly TTL_MS = 30_000;

  private readonly cache = new Map<string, { value: DirectoryProfile | null; expiresAt: number }>();

  constructor(private readonly supabase: SupabaseService) {}

  async getProfile(userId: string): Promise<DirectoryProfile | null> {
    const hit = this.cache.get(userId);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select('role, is_active')
      .eq('id', userId)
      .maybeSingle();
    // Un fallo de la base no se guarda en caché: se reintenta en la próxima petición.
    if (error) throw error;

    const value = data ? { role: data.role, isActive: data.is_active } : null;
    this.cache.set(userId, { value, expiresAt: Date.now() + UserDirectory.TTL_MS });
    return value;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }
}
