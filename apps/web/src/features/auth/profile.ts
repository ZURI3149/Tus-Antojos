import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, Database } from '@tus-antojos/shared';

export interface Profile {
  id: string;
  role: AppRole;
  fullName: string;
  isActive: boolean;
}

export type FetchProfile = (userId: string) => Promise<Profile | null>;

/**
 * Lee el perfil propio (RLS permite a cada usuario ver su fila, aun desactivado).
 * El rol sale de aquí, igual que en RLS y en la API, y no del JWT.
 */
export function createProfileFetcher(supabase: SupabaseClient<Database>): FetchProfile {
  return async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, is_active')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data
      ? { id: data.id, role: data.role, fullName: data.full_name, isActive: data.is_active }
      : null;
  };
}
