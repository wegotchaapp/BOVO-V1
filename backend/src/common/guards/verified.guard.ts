import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../../modules/auth/interfaces/auth.interface';

@Injectable()
export class VerifiedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireEmail = this.reflector.get<boolean>(
      'requireEmailVerified',
      context.getHandler(),
    );
    const requirePhone = this.reflector.get<boolean>(
      'requirePhoneVerified',
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return true;
    }

    if (requireEmail && !user.verified) {
      throw new ForbiddenException('Email verification required');
    }

    if (requirePhone && !user.phone_verified) {
      throw new ForbiddenException('Phone verification required');
    }

    return true;
  }
}
