import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tus-antojos/shared';

/** Token del cliente Supabase con service_role. */
export const SUPABASE_ADMIN = Symbol('SUPABASE_ADMIN');

@Injectable()
export class SupabaseService {
  /**
   * Cliente con service_role: salta RLS y es la ÚNICA vía de escritura del sistema.
   * Nunca debe exponerse fuera de la API.
   */
  constructor(@Inject(SUPABASE_ADMIN) readonly admin: SupabaseClient<Database>) {}

  /** Comprueba que PostgREST y PostgreSQL respondan, con tiempo límite. */
  async isDatabaseReachable(timeoutMs = 2000): Promise<boolean> {
    try {
      const { error } = await this.admin
        .from('profiles')
        .select('id', { head: true })
        .limit(1)
        .abortSignal(AbortSignal.timeout(timeoutMs));
      return !error;
    } catch {
      return false;
    }
  }
}
