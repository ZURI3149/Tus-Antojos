import type { AppRole } from '@tus-antojos/shared';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { useProfile } from '@/features/auth/use-profile';
import { FullPageMessage, LoadingScreen } from './FullPageMessage';
import { useSignOutAndLeave } from './use-sign-out';

/**
 * Protege las rutas hijas: exige sesión, un perfil activo y uno de los roles permitidos.
 * Es solo navegación: la autorización real la hacen la API (RolesGuard) y RLS.
 */
export function RequireRole({ allowed }: { allowed: readonly AppRole[] }) {
  const { status } = useAuth();
  const location = useLocation();
  const profile = useProfile();
  const signOut = useSignOutAndLeave();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (profile.isPending) return <LoadingScreen />;
  if (profile.isError) {
    return (
      <FullPageMessage
        title="No se pudo cargar tu perfil"
        description="Revisa tu conexión e inténtalo de nuevo."
      >
        <Button onClick={() => profile.refetch()}>Reintentar</Button>
        <Button variant="outline" onClick={signOut}>
          Cerrar sesión
        </Button>
      </FullPageMessage>
    );
  }
  if (!profile.data?.isActive) {
    return (
      <FullPageMessage
        title="Usuario desactivado"
        description="Tu usuario no está activo. Pide a un administrador que lo revise."
      >
        <Button variant="outline" onClick={signOut}>
          Cerrar sesión
        </Button>
      </FullPageMessage>
    );
  }
  if (!allowed.includes(profile.data.role)) return <Navigate to="/sin-acceso" replace />;

  return <Outlet />;
}
