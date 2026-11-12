import { Global, Module } from '@nestjs/common';
import { loadEnv } from './env.schema.js';

/** Token de inyección de la configuración validada (`AppConfig`). */
export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Destino de los logs (`pino.DestinationStream`). `null` = stdout.
 * Existe para que las pruebas puedan capturar los logs.
 */
export const LOG_DESTINATION = Symbol('LOG_DESTINATION');

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadEnv(process.env) },
    { provide: LOG_DESTINATION, useValue: null },
  ],
  exports: [APP_CONFIG, LOG_DESTINATION],
})
export class ConfigModule {}
