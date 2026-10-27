import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { StaffGuard } from './staff.guard';

function contextWith(authorization?: string) {
  const request = { headers: { authorization } } as Record<string, unknown>;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function guardWith(opts: { user?: { id: string } | null; role?: string }) {
  const supabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: opts.user ?? null },
        error: opts.user ? null : new Error('invalid'),
      }),
    },
    from: jest.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: opts.role ? { role: opts.role } : null,
            }),
        }),
      }),
    })),
  } as unknown as SupabaseClient;
  return new StaffGuard(supabase);
}

describe('StaffGuard', () => {
  it('refuse une requête sans token (401)', async () => {
    const { context } = contextWith(undefined);
    await expect(guardWith({}).canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuse un token invalide (401)', async () => {
    const { context } = contextWith('Bearer faux');
    await expect(
      guardWith({ user: null }).canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse un étudiant (403)', async () => {
    const { context } = contextWith('Bearer ok');
    await expect(
      guardWith({ user: { id: 'u1' }, role: 'STUDENT' }).canActivate(context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepte un éditeur et expose son id', async () => {
    const { context, request } = contextWith('Bearer ok');
    await expect(
      guardWith({ user: { id: 'u1' }, role: 'EDITOR' }).canActivate(context),
    ).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u1', role: 'EDITOR' });
  });
});
