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

    // Session and user are fetched in ONE round-trip. This guard runs on every
    // authenticated request, so a second sequential query here would add a full
    // network round-trip to every call the app makes.
    const row = await this.sessions
      .createQueryBuilder('s')
      .innerJoinAndMapOne('s.user', MobileUser, 'u', 'u.id = s.user_id')
      .where('s.token = :token', { token })
      .getOne();

    if (!row) throw new UnauthorizedException('Invalid session');

    const session = row;
    const user = (row as MobileSession & { user?: MobileUser }).user;

    if (session.expires_at.getTime() < Date.now()) {
      await this.sessions.delete({ token });
      throw new UnauthorizedException('Session expired');
    }
    if (!user) throw new UnauthorizedException('User not found');

    // Sliding expiry: an actively-used session keeps renewing, so a regular
    // user is never signed out mid-use at the 30-day mark. The write is
    // throttled so a busy client doesn't UPDATE on every single request.
    const remainingMs = session.expires_at.getTime() - Date.now();
    if (remainingMs < RENEW_WHEN_REMAINING_MS) {
      const next = new Date(Date.now() + SESSION_TTL_MS);
      // Fire-and-forget: renewal must never fail the request it rode in on.
      void this.sessions
        .update({ token }, { expires_at: next })
        .catch(() => undefined);
    }

    req.mobileUser = user;
    req.mobileToken = token;
    return true;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Must match SESSION_TTL_DAYS in mobile-auth.service.ts. */
const SESSION_TTL_MS = 30 * DAY_MS;
/** Renew once a session is inside its final week. */
const RENEW_WHEN_REMAINING_MS = 23 * DAY_MS;

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
