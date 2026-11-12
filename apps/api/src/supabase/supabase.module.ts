import { Global, Module } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@tus-antojos/shared';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';
import { SUPABASE_ADMIN, SupabaseService } from './supabase.service.js';

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_ADMIN,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        createClient<Database>(config.supabase.url, config.supabase.serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        }),
    },
    SupabaseService,
  ],
  exports: [SupabaseService],
})
export class SupabaseModule {}
