import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { FullPageMessage } from './FullPageMessage';

export function NotFoundPage() {
  return (
    <FullPageMessage
      eyebrow="Error 404"
      title="Página no encontrada"
      description="La dirección no existe o se movió."
    >
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </FullPageMessage>
  );
}
