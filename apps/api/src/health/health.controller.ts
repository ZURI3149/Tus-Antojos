import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator.js';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';
import { SupabaseService } from '../supabase/supabase.service.js';

type HealthStatus = 'ok' | 'error';

export interface HealthResponse {
  status: HealthStatus;
  db: HealthStatus;
  version: string;
}

@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly supabase: SupabaseService,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const db: HealthStatus = (await this.supabase.isDatabaseReachable()) ? 'ok' : 'error';
    if (db === 'error') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: db, db, version: this.config.appVersion };
  }
}
