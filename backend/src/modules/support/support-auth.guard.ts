import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportSession } from '../../database/entities/support-session.entity';
import { SupportAgent } from '../../database/entities/support-agent.entity';

@Injectable()
export class SupportAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(SupportSession)
    private readonly sessionRepo: Repository<SupportSession>,
    @InjectRepository(SupportAgent)
    private readonly agentRepo: Repository<SupportAgent>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException(
        'Authorization header must be Bearer <token>',
      );
    }

    const token = parts[1];
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    const session = await this.sessionRepo.findOne({ where: { id: token } });
    if (!session) {
      throw new UnauthorizedException('Invalid session token');
    }

    if (new Date() > new Date(session.expires_at)) {
      throw new UnauthorizedException('Session has expired');
    }

    const agent = await this.agentRepo.findOne({
      where: { id: session.agent_id },
    });
    if (!agent) {
      throw new UnauthorizedException('Agent not found');
    }

    request.agent = agent;
    request.session = session;

    return true;
  }
}
