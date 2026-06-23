import { UserRole } from '../../../common/enums';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  verified: boolean;
}

export interface AuthenticatedRequest {
  user: {
    id: string;
    role: UserRole;
    email: string;
  };
}
