import { Navigate } from 'react-router';
import { useProfile } from '@/features/auth/use-profile';
import { HOME_BY_ROLE } from './roles';

/** "/" lleva a la pantalla del rol. Siempre va dentro de <RequireRole>. */
export function RoleRedirect() {
  const { data: profile } = useProfile();
  return profile ? <Navigate to={HOME_BY_ROLE[profile.role]} replace /> : null;
}
