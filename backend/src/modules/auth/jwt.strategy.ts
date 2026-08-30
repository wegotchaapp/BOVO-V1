import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../../database/entities/user.entity';
import { JwtPayload } from './interfaces/auth.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'JWT_SECRET environment variable is not set',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      select: [
        'id',
        'email',
        'role',
        'is_email_verified',
        'is_phone_verified',
        'tax_blocked',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.deleted_at) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    return {
      id: user.id,
      // Keep `sub` during the controller migration: several existing routes
      // use the JWT-standard subject while newer routes use `id`.
      sub: user.id,
      email: user.email,
      role: user.role,
      verified: user.is_email_verified,
      phone_verified: user.is_phone_verified,
      tax_blocked: user.tax_blocked,
    };
  }
}
