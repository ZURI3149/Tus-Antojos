import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Marca una ruta o controlador como accesible sin JWT (p. ej. /health, webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
