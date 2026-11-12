import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { EnvValidationError, loadEnv } from './config/env.schema.js';
import { initSentry } from './observability/sentry.js';

async function bootstrap(): Promise<void> {
  // En local se lee apps/api/.env; en despliegue las variables las inyecta la plataforma.
  // Las variables ya definidas en el entorno tienen prioridad sobre el archivo.
  if (existsSync('.env')) process.loadEnvFile('.env');

  // Validar antes de crear la app para fallar rápido y con un mensaje claro.
  const config = loadEnv(process.env);
  initSentry(config);

  // bufferLogs: los mensajes del arranque esperan a que pino esté listo.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.enableShutdownHooks();
  await app.listen(config.port);
  app.get(Logger).log(`API escuchando en el puerto ${config.port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    console.error(error.message);
  } else {
    console.error('No se pudo iniciar la API:', error);
  }
  process.exit(1);
});
