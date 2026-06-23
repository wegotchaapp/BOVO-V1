import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  MobileSession,
  MobileUser,
} from '../entities/mobile.entities';
import { LoginBody, RegisterBody, UpdateMeBody } from '../dto/mobile.dto';
import { userToDto } from '../mobile.mappers';

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_DAYS = 30;
const FOUNDING_MEMBER_LIMIT = 10_000;

@Injectable()
export class MobileAuthService {
  constructor(
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
    @InjectRepository(MobileSession)
    private readonly sessions: Repository<MobileSession>,
  ) {}

  async register(dto: RegisterBody) {
    const email = dto.email.toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const priorCount = await this.users.count();
    const isFoundingMember = priorCount < FOUNDING_MEMBER_LIMIT;

    const user = this.users.create({
      name: dto.name,
      email,
      phone: dto.phone,
      password_hash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      is_founding_member: isFoundingMember,
    });
    const saved = await this.users.save(user);
    const token = await this.createSession(saved.id);
    return { user: userToDto(saved), token };
  }

  async login(dto: LoginBody) {
    const email = dto.email.toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const token = await this.createSession(user.id);
    return { user: userToDto(user), token };
  }

  async logout(token: string | null) {
    if (token) await this.sessions.delete({ token });
    return { ok: true };
  }

  me(user: MobileUser) {
    return userToDto(user);
  }

  async patchMe(user: MobileUser, dto: UpdateMeBody) {
    // `isVerified` and `isFoundingMember` are intentionally not client-writable.
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.onboarded !== undefined) user.onboarded = dto.onboarded;
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phone !== undefined) user.phone = dto.phone;
    const saved = await this.users.save(user);
    return userToDto(saved);
  }

  private async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex'); // 64 chars
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
    await this.sessions.save(
      this.sessions.create({
        token,
        user_id: userId,
        expires_at: expiresAt,
      }),
    );
    return token;
  }
}
