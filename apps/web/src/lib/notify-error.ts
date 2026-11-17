import { toast } from 'sonner';
import { ApiError } from './api-client';

/**
 * Muestra un error como aviso. 401 y 403 ya los avisa el cliente HTTP.
 * `describe` permite a cada pantalla enriquecer el mensaje (p. ej. con `details`).
 */
export function notifyError(error: unknown, describe?: (error: ApiError) => string): void {
  if (
    error instanceof ApiError &&
    (error.code === 'UNAUTHENTICATED' || error.code === 'FORBIDDEN')
  ) {
    return;
  }
  if (error instanceof ApiError && describe) {
    toast.error(describe(error));
    return;
  }
  toast.error(error instanceof Error ? error.message : 'Ocurrió un error inesperado');
}
