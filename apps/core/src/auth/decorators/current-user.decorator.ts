import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserFromToken } from '../interfaces';

export const CurrentUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): UserFromToken => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);
