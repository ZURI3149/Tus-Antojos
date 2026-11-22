import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth-context';
import { clearCachedProfile, readCachedProfile, saveCachedProfile } from './profile-cache';

/**
 * Perfil (rol, nombre, activo) del usuario con sesión. Arranca con el último perfil conocido
 * guardado en el dispositivo para que la caja abra sin red (OP-D9); la lectura de la base,
 * cuando llega, manda (p. ej. si el usuario fue desactivado).
 */
export function useProfile() {
  const { session, fetchProfile } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const profile = await fetchProfile(userId as string);
      if (profile) saveCachedProfile(profile);
      else clearCachedProfile(userId as string);
      return profile;
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
    initialData: () => (userId ? (readCachedProfile(userId) ?? undefined) : undefined),
    // La copia cuenta como vieja: se vuelve a leer apenas haya red.
    initialDataUpdatedAt: 0,
  });
}
