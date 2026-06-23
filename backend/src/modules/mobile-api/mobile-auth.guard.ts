import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MobileSession, MobileUser } from './entities/mobile.entities';

/**
 * Bovogo mobile uses a single long-lived (30-day) opaque Bearer token rather
 * than the platform's short JWT + refresh pair. This guard validates that token
 * against the `mobile_sessions` table and attaches the resolved user to the
 * request as `mobileUser`.
 */
@Injectable()
export class MobileAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(MobileSession)
    private readonly sessions: Repository<MobileSession>,
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = extractBearer(req);
    if (!token) throw new UnauthorizedException('Authentication required');

    const session = await this.sessions.findOne({ where: { token } });
    if (!session) throw new UnauthorizedException('Invalid session');
    if (session.expires_at.getTime() < Date.now()) {
      await this.sessions.delete({ token });
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.users.findOne({ where: { id: session.user_id } });
    if (!user) throw new UnauthorizedException('User not found');

    req.mobileUser = user;
    req.mobileToken = token;
    return true;
  }
}

export function extractBearer(req: any): string | null {
  const header: string | undefined = req.headers?.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Injects the authenticated `MobileUser` into a controller handler. */
export const MobileAuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MobileUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.mobileUser as MobileUser;
  },
);
