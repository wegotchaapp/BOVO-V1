import { UserRole } from '../../../common/enums';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  verified: boolean;
}

export interface AuthenticatedUser {
  /** Canonical application user id. */
  id: string;
  /** Legacy controllers still read the JWT-standard subject field. */
  sub: string;
  email: string;
  role: UserRole;
  verified: boolean;
  phone_verified: boolean;
  tax_blocked: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
