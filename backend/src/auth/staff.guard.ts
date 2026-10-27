import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase.module';

export interface StaffUser {
  id: string;
  role: 'EDITOR' | 'ADMIN';
}

export type AuthedRequest = Request & { user?: StaffUser };

/**
 * Réserve une route aux comptes EDITOR ou ADMIN.
 * 1) le token "Bearer" est vérifié par Supabase Auth ;
 * 2) le rôle est lu dans la table profiles (jamais dans le token ni côté client).
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Token manquant');

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('Token invalide');

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profile || (profile.role !== 'EDITOR' && profile.role !== 'ADMIN')) {
      throw new ForbiddenException('Droits insuffisants');
    }

    req.user = { id: data.user.id, role: profile.role };
    return true;
  }
}
