import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest, StaffUser } from './staff.guard';

/** Utilisateur authentifié par StaffGuard (toujours présent derrière le guard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): StaffUser =>
    context.switchToHttp().getRequest<AuthedRequest>().user!,
);
