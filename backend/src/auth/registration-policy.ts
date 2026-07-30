import { ForbiddenException } from '@nestjs/common';

export function assertPublicRegistrationAllowed(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const enabled = ['1', 'true'].includes(
    String(env.ALLOW_PUBLIC_REGISTRATION || '').toLowerCase(),
  );
  if (env.NODE_ENV === 'production' && !enabled) {
    throw new ForbiddenException(
      'Public registration is disabled. Ask an administrator for an invitation.',
    );
  }
}
