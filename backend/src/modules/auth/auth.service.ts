import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import {
  RegisterDto,
  LoginDto,
  AuthResponseDto,
  SocialAuthDto,
  SupabaseAuthDto,
  SignupDto,
  OtpVerifyDto,
} from './dto/auth.dto';
import { PinoLogger } from 'nestjs-pino';
import { UserRole } from '../../common/enums';
import { JwtPayload } from './interfaces/auth.interface';
import { SupabaseService } from '../supabase/supabase.service';

const HIBP_API = 'https://api.pwnedpasswords.com/range/';
const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
    private readonly supabase: SupabaseService,
  ) {}

  async signup(dto: SignupDto): Promise<{ userId: string; message: string }> {
    const existing = await this.userRepo.findOne({
      where: [{ email: dto.email.toLowerCase() }, { phone: dto.phone }],
    });
    if (existing) {
      throw new ConflictException('Email or phone already registered');
    }

    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      name: dto.name,
      is_email_verified: false,
      is_phone_verified: false,
      selected_role: 'rider',
    });

    const saved = await this.userRepo.save(user);
    await this.sendPhoneOtp(saved.phone!);

    this.logger.info({ userId: saved.id, email: saved.email }, 'Pending user created, OTP sent');

    return {
      userId: saved.id,
      message: 'OTP sent to your phone. Please verify to continue.',
    };
  }

  async verifyOtp(dto: OtpVerifyDto): Promise<AuthResponseDto> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await this.checkPhoneOtp(user.phone!, dto.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    user.is_phone_verified = true;
    await this.userRepo.save(user);

    const tokens = await this.generateTokens(user);

    this.logger.info({ userId: user.id }, 'Phone verified, user activated');

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async register(dto: RegisterDto): Promise<{ userId: string; email: string; phone: string | null; message: string }> {
    const existing = await this.userRepo.findOne({
      where: [{ email: dto.email.toLowerCase() }, { phone: dto.phone }],
    });
    if (existing) {
      throw new ConflictException('Email or phone already registered');
    }

    const age = this.calculateAge(dto.dob);
    if (age < 18) {
      throw new BadRequestException('You must be at least 18 years old to use Bovogo');
    }

    const breached = await this.checkHibp(dto.password);
    if (breached) {
      throw new BadRequestException('Password has been found in a data breach. Please choose a different password.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const emailVerificationToken = this.generateVerificationToken();

    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      name: dto.name,
      dob: dto.dob,
      password_hash: passwordHash,
      is_email_verified: false,
      is_phone_verified: false,
      selected_role: dto.selected_role || 'rider',
    });

    const saved = await this.userRepo.save(user);

    await Promise.allSettled([
      this.sendEmailVerification(saved.email, emailVerificationToken),
      saved.phone ? this.sendPhoneOtp(saved.phone) : Promise.resolve(),
    ]);

    this.logger.info({ userId: saved.id, email: saved.email }, 'User registered');

    return {
      userId: saved.id,
      email: saved.email,
      phone: saved.phone,
      message: 'Account created. Please verify your email and phone to proceed.',
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const identifier = dto.identifier.toLowerCase();
    const isEmail = identifier.includes('@');

    const user = await this.userRepo.findOne({
      where: isEmail ? { email: identifier } : { phone: identifier },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.deleted_at) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async refreshToken(token: string, deviceInfo?: string): Promise<{ accessToken: string; refreshToken: string }> {
    const stored = await this.refreshRepo.findOne({
      where: { token, is_revoked: false },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date(stored.expires_at) < new Date()) {
      stored.is_revoked = true;
      stored.revoked_reason = 'expired';
      await this.refreshRepo.save(stored);
      throw new UnauthorizedException('Refresh token has expired');
    }

    stored.is_revoked = true;
    stored.revoked_reason = 'rotated';
    await this.refreshRepo.save(stored);

    const user = await this.userRepo.findOne({ where: { id: stored.user_id } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(user, deviceInfo);
    return tokens;
  }

  async logout(token: string): Promise<void> {
    const stored = await this.refreshRepo.findOne({ where: { token } });
    if (stored && !stored.is_revoked) {
      stored.is_revoked = true;
      stored.revoked_reason = 'logout';
      await this.refreshRepo.save(stored);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshRepo.update(
      { user_id: userId, is_revoked: false },
      { is_revoked: true, revoked_reason: 'logout_all' },
    );
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.is_email_verified) {
      throw new BadRequestException('Email already verified');
    }

    user.is_email_verified = true;
    await this.userRepo.save(user);

    this.logger.info({ userId: user.id }, 'Email verified');
  }

  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_email_verified) {
      throw new BadRequestException('Email already verified');
    }

    await this.sendEmailVerification(user.email, user.id);
  }

  async verifyPhone(phone: string, code: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) {
      throw new BadRequestException('Phone number not found');
    }

    const isValid = await this.checkPhoneOtp(phone, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    user.is_phone_verified = true;
    await this.userRepo.save(user);

    this.logger.info({ userId: user.id, phone }, 'Phone verified');
  }

  async sendPhoneVerification(phone: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_phone_verified) {
      throw new BadRequestException('Phone already verified');
    }

    await this.sendPhoneOtp(phone);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return;
    }

    const resetToken = this.generateVerificationToken();
    const resetExpiry = new Date();
    resetExpiry.setHours(resetExpiry.getHours() + 1);

    await this.sendPasswordResetEmail(user.email, resetToken);

    this.logger.info({ userId: user.id }, 'Password reset email sent');
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const breached = await this.checkHibp(newPassword);
    if (breached) {
      throw new BadRequestException('Password has been found in a data breach. Please choose a different password.');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.password_hash = passwordHash;
    await this.userRepo.save(user);

    await this.logoutAll(user.id);

    this.logger.info({ userId: user.id }, 'Password reset completed');
  }

  async supabaseAuth(dto: SupabaseAuthDto, deviceInfo?: string): Promise<AuthResponseDto> {
    const { data, error } = await this.supabase.getAdminClient().auth.getUser(dto.access_token);

    if (error || !data?.user) {
      this.logger.warn({ error }, 'Supabase token verification failed');
      throw new UnauthorizedException('Invalid Supabase authentication token');
    }

    const supabaseUser = data.user;
    const email = supabaseUser.email;

    if (!email) {
      throw new UnauthorizedException('Email is required for authentication');
    }

    let user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      const phone = supabaseUser.phone || null;
      const name = dto.name || supabaseUser.user_metadata?.full_name || email.split('@')[0];

      user = this.userRepo.create({
        email: email.toLowerCase(),
        phone,
        name,
        is_email_verified: !!supabaseUser.email_confirmed_at,
        is_phone_verified: !!supabaseUser.phone_confirmed_at,
        selected_role: 'rider',
      });
      await this.userRepo.save(user);

      this.logger.info({ userId: user.id, email }, 'User created via Supabase auth');
    } else if (user.deleted_at) {
      throw new UnauthorizedException('Account has been deactivated');
    } else {
      if (supabaseUser.email_confirmed_at && !user.is_email_verified) {
        user.is_email_verified = true;
      }
      if (supabaseUser.phone_confirmed_at && !user.is_phone_verified) {
        user.is_phone_verified = true;
      }
      if (supabaseUser.phone && !user.phone) {
        user.phone = supabaseUser.phone;
      }
      await this.userRepo.save(user);
    }

    const tokens = await this.generateTokens(user, deviceInfo);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async socialAuth(dto: SocialAuthDto, deviceInfo?: string): Promise<AuthResponseDto> {
    let email: string | null = null;
    let name: string | null = null;
    let socialId: string | null = null;

    try {
      if (dto.provider === 'apple') {
        const decoded = this.verifyAppleToken(dto.token);
        email = decoded.email;
        name = decoded.name;
        socialId = decoded.sub;
      } else if (dto.provider === 'google') {
        const decoded = await this.verifyGoogleToken(dto.token);
        email = decoded.email;
        name = decoded.name;
        socialId = decoded.sub;
      }

      if (!email) {
        throw new UnauthorizedException('Could not extract email from social provider');
      }
    } catch (error) {
      this.logger.error({ provider: dto.provider, error }, 'Social auth verification failed');
      throw new UnauthorizedException('Invalid social authentication token');
    }

    let user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      throw new UnauthorizedException(
        'No Bovogo account found for this social login. Please create an account first.',
      );
    }

    if (user.deleted_at) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    const tokens = await this.generateTokens(user, deviceInfo);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async resendEmailVerification(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_email_verified) {
      throw new BadRequestException('Email already verified');
    }

    await this.sendEmailVerification(user.email, user.id);
  }

  async resendPhoneOtp(phone: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_phone_verified) {
      throw new BadRequestException('Phone already verified');
    }

    await this.sendPhoneOtp(phone);
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'phone', 'name', 'role', 'selected_role', 'is_email_verified', 'is_phone_verified', 'is_founding_member', 'background_check_status', 'subscription_tier', 'subscription_expires_at', 'created_at', 'rider_conversation_style', 'rider_music_preference', 'rider_smoking_preference', 'rider_pet_preference'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, updates: Partial<Pick<User, 'name' | 'phone'>>) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updates.phone && updates.phone !== user.phone) {
      const existing = await this.userRepo.findOne({ where: { phone: updates.phone } });
      if (existing) {
        throw new ConflictException('Phone number already in use');
      }
      user.is_phone_verified = false;
    }

    Object.assign(user, updates);
    const saved = await this.userRepo.save(user);
    return this.sanitizeUser(saved);
  }

  private async generateTokens(user: User, deviceInfo?: string) {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      verified: user.is_email_verified,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '30m',
    });

    const refreshTokenStr = this.jwtService.sign(
      { sub: user.id },
      {
        expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d`,
        secret: this.getRefreshTokenSecret(),
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    const rt = this.refreshRepo.create({
      user_id: user.id,
      token: refreshTokenStr,
      expires_at: expiresAt.toISOString(),
      device_info: deviceInfo || null,
    });
    await this.refreshRepo.save(rt);

    return { accessToken, refreshToken: refreshTokenStr };
  }

  private async checkHibp(password: string): Promise<boolean> {
    try {
      const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      const response = await fetch(`${HIBP_API}${prefix}`);
      if (!response.ok) return false;

      const text = await response.text();
      const lines = text.split('\n');
      return lines.some((line) => {
        const [hashSuffix, count] = line.split(':');
        return hashSuffix === suffix && parseInt(count, 10) > 10;
      });
    } catch (error) {
      this.logger.warn({ error }, 'HIBP check failed, proceeding');
      return false;
    }
  }

  private calculateAge(dob: string): number {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  private generateVerificationToken(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 64);
  }

  private async sendEmailVerification(email: string, token: string): Promise<void> {
    const resendApiKey = this.config.get<string>('RESEND_API_KEY');
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');

    if (!resendApiKey) {
      this.logger.warn({ email }, 'RESEND_API_KEY not configured, skipping email');
      return;
    }

    const verificationUrl = `${appUrl}/api/auth/verify-email?token=${token}`;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Bovogo <hello@bovogo.com>',
          to: [email],
          subject: 'Verify your Bovogo email',
          html: `
            <h2>Welcome to Bovogo!</h2>
            <p>Click the link below to verify your email address:</p>
            <a href="${verificationUrl}">Verify Email</a>
            <p>This link will expire in 24 hours.</p>
          `,
        }),
      });

      this.logger.info({ email }, 'Verification email sent');
    } catch (error) {
      this.logger.error({ email, error }, 'Failed to send verification email');
    }
  }

  private async sendPhoneOtp(phone: string): Promise<void> {
    const twilioSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const verifyServiceSid = this.config.get<string>('TWILIO_VERIFY_SERVICE_SID');

    if (!twilioSid || !twilioToken || !verifyServiceSid) {
      this.logger.warn({ phone }, 'Twilio not configured, skipping OTP');
      return;
    }

    try {
      const encodedSid = encodeURIComponent(twilioSid);
      const encodedToken = encodeURIComponent(twilioToken);
      const encodedServiceSid = encodeURIComponent(verifyServiceSid);
      const encodedPhone = encodeURIComponent(phone);

      const auth = Buffer.from(`${encodedSid}:${encodedToken}`).toString('base64');

      await fetch(`https://verify.twilio.com/2010-04-01/Accounts/${twilioSid}/Services/${verifyServiceSid}/Verifications`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `To=${encodedPhone}&Channel=sms`,
      });

      this.logger.info({ phone }, 'Phone OTP sent');
    } catch (error) {
      this.logger.error({ phone, error }, 'Failed to send phone OTP');
    }
  }

  private async checkPhoneOtp(phone: string, code: string): Promise<boolean> {
    const twilioSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const verifyServiceSid = this.config.get<string>('TWILIO_VERIFY_SERVICE_SID');

    if (!twilioSid || !twilioToken || !verifyServiceSid) {
      this.logger.error({ phone }, 'Twilio not configured - phone verification unavailable');
      throw new Error('Phone verification is not available. Please configure TWILIO_VERIFY_SERVICE_SID in environment.');
    }

    try {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');

      const response = await fetch(`https://verify.twilio.com/2010-04-01/Accounts/${twilioSid}/Services/${verifyServiceSid}/VerificationCheck`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `To=${encodeURIComponent(phone)}&Code=${encodeURIComponent(code)}`,
      });

      const data = await response.json();
      return data.status === 'approved';
    } catch (error) {
      this.logger.error({ phone, error }, 'Failed to verify phone OTP');
      return false;
    }
  }

  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resendApiKey = this.config.get<string>('RESEND_API_KEY');
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');

    if (!resendApiKey) {
      this.logger.warn({ email }, 'RESEND_API_KEY not configured, skipping reset email');
      return;
    }

    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Bovogo <hello@bovogo.com>',
          to: [email],
          subject: 'Reset your Bovogo password',
          html: `
            <h2>Password Reset Request</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${resetUrl}">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          `,
        }),
      });
    } catch (error) {
      this.logger.error({ email, error }, 'Failed to send password reset email');
    }
  }

  private verifyAppleToken(token: string): { email: string | null; name: string | null; sub: string } {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.config.get<string>('APPLE_CLIENT_SECRET'),
        algorithms: ['RS256'],
      });

      return {
        email: decoded.email || null,
        name: decoded.name || null,
        sub: decoded.sub,
      };
    } catch {
      throw new UnauthorizedException('Invalid Apple token');
    }
  }

  private async verifyGoogleToken(token: string): Promise<{ email: string; name: string | null; sub: string }> {
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      const data = await response.json();

      if (data.error || !data.email) {
        throw new UnauthorizedException('Invalid Google token');
      }

      return {
        email: data.email,
        name: data.name || null,
        sub: data.sub,
      };
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  private getRefreshTokenSecret(): string {
    return this.config.get<string>('JWT_SECRET') + '_refresh';
  }

  private sanitizeUser(user: User) {
    const { password_hash, deleted_at, ...sanitized } = user;
    return sanitized;
  }

  async acceptBiometricConsent(userId: string): Promise<{ consent_recorded: true; accepted_at: string }> {
    const acceptedAt = new Date().toISOString();
    await this.userRepo.update(userId, {
      biometric_consent_given: true,
      biometric_consent_at: acceptedAt,
    });
    this.logger.info({ userId }, 'Biometric consent recorded (Texas BUIA compliance)');
    return { consent_recorded: true, accepted_at: acceptedAt };
  }

  async switchRole(userId: string, selected_role: 'rider' | 'driver' | 'both'): Promise<{ selected_role: string }> {
    await this.userRepo.update(userId, { selected_role });
    this.logger.info({ userId, selected_role }, 'User role switched');
    return { selected_role };
  }
}
