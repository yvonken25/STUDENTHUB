import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE = 'SUPABASE_CLIENT';

/**
 * Client Supabase unique, utilisé uniquement côté serveur.
 * Il utilise la clé service_role, qui CONTOURNE la RLS : c'est donc au code
 * des services de filtrer ce qui est public. Cette clé ne doit jamais sortir
 * du backend (ni frontend, ni WordPress).
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SupabaseClient =>
        createClient(
          config.getOrThrow<string>('SUPABASE_URL'),
          config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
          { auth: { persistSession: false, autoRefreshToken: false } },
        ),
    },
  ],
  exports: [SUPABASE],
})
export class SupabaseModule {}
