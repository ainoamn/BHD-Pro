import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TokenPayload } from '../../auth/interfaces/token-payload.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
