import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ContentsModule } from './contents/contents.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    // Charge le fichier .env (jamais versionné) dans process.env
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    ContentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
