import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  MobileBooking,
  MobileConversation,
  MobileDirectMessage,
  MobileLiveLocation,
  MobileRating,
  MobileSession,
  MobileTrip,
  MobileTripGroupMember,
  MobileTripGroupMessage,
  MobileTripReply,
  MobileTripReplyRead,
  MobileUser,
  MobileVehicle,
} from '../entities/mobile.entities';
import {
  LoginBody,
  NotificationSettingsBody,
  OAuthLoginBody,
  RegisterBody,
  UpdateMeBody,
} from '../dto/mobile.dto';
import { notificationSettingsFromUser, userToDto } from '../mobile.mappers';
import { MobileIdentityService } from './mobile-identity.service';

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_DAYS = 30;
const FOUNDING_MEMBER_LIMIT = 10_000;
const DELETION_GRACE_DAYS = 7;

@Injectable()
export class MobileAuthService {
  constructor(
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
    @InjectRepository(MobileSession)
    private readonly sessions: Repository<MobileSession>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly identity: MobileIdentityService,
  ) {}

  async register(dto: RegisterBody) {
    const email = dto.email.toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      await this.purgeIfExpired(existing);
      const still = await this.users.findOne({ where: { email } });
      if (still) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
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
    await this.purgeIfExpired(user);
    const still = await this.users.findOne({ where: { id: user.id } });
    if (!still) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (still.deletion_requested_at) {
      // Still within grace — allow login but surface the schedule.
    }
    const token = await this.createSession(still.id);
    return { user: userToDto(still), token };
  }

  async oauthLogin(dto: OAuthLoginBody) {
    const profile =
      dto.provider === 'google'
        ? await this.verifyGoogleToken(dto.idToken)
        : await this.verifyAppleToken(dto.idToken, dto.email, dto.name);

    const email = (profile.email || dto.email || '').toLowerCase();
    if (!email) {
      throw new BadRequestException(
        'Email is required from the identity provider.',
      );
    }

    let user = await this.users.findOne({
      where: [
        { oauth_provider: dto.provider, oauth_subject: profile.subject },
        { email },
      ],
    });

    if (user) {
      await this.purgeIfExpired(user);
      user = await this.users.findOne({ where: { email } });
    }

    if (!user) {
      const priorCount = await this.users.count();
      user = await this.users.save(
        this.users.create({
          name: profile.name || dto.name || email.split('@')[0],
          email,
          phone: null,
          password_hash: await bcrypt.hash(
            randomBytes(32).toString('hex'),
            BCRYPT_ROUNDS,
          ),
          is_founding_member: priorCount < FOUNDING_MEMBER_LIMIT,
          oauth_provider: dto.provider,
          oauth_subject: profile.subject,
        }),
      );
    } else {
      user.oauth_provider = dto.provider;
      user.oauth_subject = profile.subject;
      if (!user.name && (profile.name || dto.name)) {
        user.name = profile.name || dto.name || user.name;
      }
      user = await this.users.save(user);
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
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.onboarded !== undefined) user.onboarded = dto.onboarded;
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.bio !== undefined) user.bio = dto.bio.trim();
    if (dto.languages !== undefined) {
      user.languages = JSON.stringify(
        dto.languages.map((l) => String(l).trim()).filter(Boolean),
      );
    }
    if (dto.emergencyName !== undefined) {
      user.emergency_name = dto.emergencyName.trim();
    }
    if (dto.emergencyPhone !== undefined) {
      user.emergency_phone = dto.emergencyPhone.trim();
    }
    if (dto.photoUrl !== undefined) {
      if (dto.photoUrl.length > 1_500_000) {
        throw new BadRequestException(
          'Photo is too large. Please choose a smaller image.',
        );
      }
      user.photo_url = dto.photoUrl || null;
    }
    if (dto.ridePreferences !== undefined) {
      user.ride_preferences = JSON.stringify(dto.ridePreferences ?? {});
    }

    // A profile photo is mandatory. Enforce it here as well as in the client so
    // onboarding cannot be completed by calling the API directly.
    if (dto.onboarded === true && !user.photo_url) {
      throw new BadRequestException(
        'A profile photo is required before you can finish setting up your account.',
      );
    }

    const saved = await this.users.save(user);
    return userToDto(saved);
  }

  async updateNotificationSettings(
    user: MobileUser,
    dto: NotificationSettingsBody,
  ) {
    const current = notificationSettingsFromUser(user);
    const next = {
      pushEnabled: dto.pushEnabled ?? current.pushEnabled,
      emailEnabled: dto.emailEnabled ?? current.emailEnabled,
      tripUpdates: dto.tripUpdates ?? current.tripUpdates,
      marketing: dto.marketing ?? current.marketing,
      messages: dto.messages ?? current.messages,
    };
    user.notification_settings = JSON.stringify(next);
    const saved = await this.users.save(user);
    return {
      notificationSettings: notificationSettingsFromUser(saved),
      user: userToDto(saved),
    };
  }

  /**
   * CCPA: schedule deletion (7-day grace), revoke sessions, then purge after grace.
   */
  async requestDeletion(user: MobileUser, token: string | null) {
    user.deletion_requested_at = new Date();
    await this.users.save(user);
    await this.sessions.delete({ user_id: user.id });
    if (token) await this.sessions.delete({ token });
    const purgeAt = new Date(user.deletion_requested_at);
    purgeAt.setDate(purgeAt.getDate() + DELETION_GRACE_DAYS);
    return {
      ok: true,
      deletionRequestedAt: user.deletion_requested_at.toISOString(),
      purgeAt: purgeAt.toISOString(),
    };
  }

  async cancelDeletion(user: MobileUser) {
    if (!user.deletion_requested_at) {
      return { ok: true, user: userToDto(user) };
    }
    user.deletion_requested_at = null;
    const saved = await this.users.save(user);
    return { ok: true, user: userToDto(saved) };
  }

  /**
   * Deliberately propagates. If the purge cannot complete — private storage is
   * unreachable, say — the account's data still exists, so reporting the sign-in
   * or registration as fine would be a lie. The next attempt retries it.
   */
  private async purgeIfExpired(user: MobileUser) {
    if (!user.deletion_requested_at) return;
    const purgeAt = new Date(user.deletion_requested_at);
    purgeAt.setDate(purgeAt.getDate() + DELETION_GRACE_DAYS);
    if (Date.now() < purgeAt.getTime()) return;
    await this.purgeUser(user.id);
  }

  private async purgeUser(userId: string) {
    await this.dataSource.transaction(async (tx) => {
      // Lock the account first. `mobile_identity_verifications` has no foreign
      // key to it, so without the lock an ID submission committing mid-purge
      // would outlive the user it belongs to, images and all.
      const owner = await tx.getRepository(MobileUser).findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      // Another request purged it already; nothing left to do.
      if (!owner) return;

      // Identity images go first, by key. They live in private storage rather
      // than the database, so this is the one irreversible step — a removal
      // that fails throws, rolling the purge back with the keys intact so the
      // next attempt can finish it.
      await this.identity.purge(userId, tx);

      await tx.getRepository(MobileSession).delete({ user_id: userId });
      await tx.getRepository(MobileVehicle).delete({ user_id: userId });
      await tx.getRepository(MobileRating).delete({ rater_id: userId });
      await tx.getRepository(MobileRating).delete({ ratee_id: userId });
      await tx.getRepository(MobileLiveLocation).delete({ user_id: userId });
      await tx.getRepository(MobileTripReplyRead).delete({ user_id: userId });
      await tx.getRepository(MobileTripReply).delete({ user_id: userId });
      await tx.getRepository(MobileTripGroupMember).delete({ user_id: userId });
      await tx
        .getRepository(MobileTripGroupMessage)
        .delete({ sender_id: userId });
      await tx.getRepository(MobileDirectMessage).delete({ sender_id: userId });
      await tx.getRepository(MobileBooking).delete({ rider_id: userId });
      await tx.getRepository(MobileTrip).delete({ driver_id: userId });

      // Remove conversations where user is a participant.
      const convos = await tx.getRepository(MobileConversation).find({
        where: [{ user_low_id: userId }, { user_high_id: userId }],
      });
      for (const c of convos) {
        await tx
          .getRepository(MobileDirectMessage)
          .delete({ conversation_id: c.id });
        await tx.getRepository(MobileConversation).delete({ id: c.id });
      }

      await tx.getRepository(MobileUser).delete({ id: userId });
    });
  }

  private async verifyGoogleToken(idToken: string): Promise<{
    subject: string;
    email: string;
    name?: string;
  }> {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) {
      throw new UnauthorizedException('Invalid Google identity token.');
    }
    const data = (await res.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      aud?: string;
      email_verified?: string;
    };
    const expectedAud =
      this.config.get<string>('GOOGLE_CLIENT_ID') ||
      this.config.get<string>('EXPO_PUBLIC_GOOGLE_CLIENT_ID');
    if (expectedAud && data.aud && data.aud !== expectedAud) {
      // Accept either web or iOS/android client ids when configured as comma list.
      const allowed = expectedAud.split(',').map((s) => s.trim());
      if (!allowed.includes(data.aud)) {
        throw new UnauthorizedException('Google token audience mismatch.');
      }
    }
    if (!data.sub || !data.email) {
      throw new UnauthorizedException('Google token missing profile fields.');
    }
    return {
      subject: data.sub,
      email: data.email,
      name: data.name,
    };
  }

  private async verifyAppleToken(
    idToken: string,
    fallbackEmail?: string,
    fallbackName?: string,
  ): Promise<{ subject: string; email: string; name?: string }> {
    const parts = idToken.split('.');
    if (parts.length < 2) {
      throw new UnauthorizedException('Invalid Apple identity token.');
    }
    const payload = JSON.parse(
      Buffer.from(
        parts[1].replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8'),
    ) as {
      sub?: string;
      email?: string;
      iss?: string;
      aud?: string;
      exp?: number;
    };
    if (payload.iss !== 'https://appleid.apple.com') {
      throw new UnauthorizedException('Invalid Apple token issuer.');
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Apple token expired.');
    }
    const expectedAud = this.config.get<string>('APPLE_CLIENT_ID');
    if (expectedAud && payload.aud && payload.aud !== expectedAud) {
      throw new UnauthorizedException('Apple token audience mismatch.');
    }
    const email = (payload.email || fallbackEmail || '').toLowerCase();
    if (!payload.sub || !email) {
      throw new UnauthorizedException(
        'Apple sign-in did not provide an email. Use email/password or try again.',
      );
    }
    return {
      subject: payload.sub,
      email,
      name: fallbackName,
    };
  }

  private async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
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
