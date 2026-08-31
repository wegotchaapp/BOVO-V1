import {
  Injectable,
  ForbiddenException,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../../modules/auth/interfaces/auth.interface';

@Injectable()
export class TaxComplianceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) return true;

    if (user.tax_blocked) {
      throw new ForbiddenException(
        'Payouts paused: IRS requires tax documentation (Form W-9) before processing payments exceeding $600/year. Please upload your W-9 form.',
      );
    }

    return true;
  }
}
