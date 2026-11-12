import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { FullPageMessage } from './FullPageMessage';
import { useSignOutAndLeave } from './use-sign-out';

export function NoAccessPage() {
  const signOut = useSignOutAndLeave();
  return (
    <FullPageMessage
      title="Sin acceso"
      description="Tu rol no tiene permiso para ver esta pantalla."
    >
      <Button asChild>
        <Link to="/">Ir a mi inicio</Link>
      </Button>
      <Button variant="outline" onClick={signOut}>
        Cerrar sesión
      </Button>
    </FullPageMessage>
  );
}
