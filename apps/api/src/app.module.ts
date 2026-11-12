import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { AuthModule } from './auth/auth.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { buildLoggerParams } from './common/logger.js';
import { APP_CONFIG, ConfigModule, LOG_DESTINATION } from './config/config.module.js';
import type { AppConfig } from './config/env.schema.js';
import { HealthController } from './health/health.controller.js';
import { UsersModule } from './modules/users/users.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG, LOG_DESTINATION],
      useFactory: (config: AppConfig, destination: DestinationStream | null) =>
        buildLoggerParams(config, destination),
    }),
    SupabaseModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
