import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth-context';

/** Perfil (rol, nombre, activo) del usuario con sesión. */
export function useProfile() {
  const { session, fetchProfile } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}
