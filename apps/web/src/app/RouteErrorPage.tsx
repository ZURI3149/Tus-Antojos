import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { FullPageMessage } from './FullPageMessage';
import { NotFoundPage } from './NotFoundPage';

/**
 * errorElement de la ruta raíz: React Router atrapa aquí los errores al dibujar
 * una pantalla (no llegan a un ErrorBoundary externo). Se reportan a Sentry.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    if (!isNotFound) Sentry.captureException(error);
  }, [error, isNotFound]);

  if (isNotFound) return <NotFoundPage />;

  return (
    <FullPageMessage
      title="Algo salió mal"
      description="Ocurrió un error inesperado. Recarga la página para continuar."
    >
      <Button onClick={() => window.location.reload()}>Recargar</Button>
    </FullPageMessage>
  );
}
