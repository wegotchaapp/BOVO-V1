import { Injectable, ForbiddenException } from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class TaxComplianceGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
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
