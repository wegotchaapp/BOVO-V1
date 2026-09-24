import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  VerifyPhoneDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SocialAuthDto,
  SupabaseAuthDto,
  SignupDto,
  OtpVerifyDto,
} from './dto/auth.dto';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Create a pending user and send OTP to phone' })
  @ApiResponse({ status: 201, description: 'Pending user created, OTP sent' })
  @ApiResponse({
    status: 409,
    description: 'Email or phone already registered',
  })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('otp/verify')
  // A 6-digit code is only as strong as the number of guesses allowed.
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  @ApiOperation({ summary: 'Verify phone OTP and complete registration' })
  @ApiResponse({ status: 200, description: 'Phone verified, user activated' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User registered, verification required',
  })
  @ApiResponse({
    status: 400,
    description: 'Under 18, breached password, or invalid input',
  })
  @ApiResponse({
    status: 409,
    description: 'Email or phone already registered',
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('signin')
  // 10 attempts per 5 minutes per caller: a brute force dies at 2/min, while a
  // household or office sharing one NAT address can still fumble a password.
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email/phone and password' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async signin(@Body() dto: LoginDto, @Request() req: any) {
    return this.authService.login(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email/phone and password' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Request() req: any) {
    return this.authService.login(dto);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email address with token' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({
    status: 400,
    description: 'Invalid token or already verified',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Email verified successfully' };
  }

  @Post('verify-email/resend')
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Resend email verification' })
  async resendEmailVerification(@Body('user_id') userId: string) {
    await this.authService.resendEmailVerification(userId);
    return { message: 'Verification email resent' };
  }

  @Post('verify-phone')
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  @ApiOperation({ summary: 'Verify phone number with OTP' })
  @ApiResponse({ status: 200, description: 'Phone verified' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyPhone(@Body() dto: VerifyPhoneDto) {
    await this.authService.verifyPhone(dto.phone, dto.code);
    return { message: 'Phone verified successfully' };
  }

  @Post('verify-phone/resend')
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Resend phone OTP' })
  async resendPhoneOtp(@Body('phone') phone: string) {
    await this.authService.resendPhoneOtp(phone);
    return { message: 'OTP resent' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token with rotation' })
  @ApiResponse({ status: 200, description: 'New token pair issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Request() req: any) {
    return this.authService.refreshToken(
      dto.refresh_token,
      req.headers['user-agent'],
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Revoke current refresh token' })
  async logout(@Request() req: any, @Body('refresh_token') token: string) {
    await this.authService.logout(token);
    return { message: 'Logged out successfully' };
  }

  @Post('logout/all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Revoke all refresh tokens for user' })
  async logoutAll(@Request() req: any) {
    await this.authService.logoutAll(req.user.id);
    return { message: 'All sessions terminated' };
  }

  @Post('supabase')
  // Unthrottled until now. Each call verifies a token against Supabase, so an
  // open loop here is both a credential oracle and an egress bill.
  @Throttle({ default: { limit: 30, ttl: 300000 } })
  @ApiOperation({
    summary: 'Authenticate or sync user via Supabase Auth token',
  })
  @ApiResponse({ status: 200, description: 'Auth successful' })
  @ApiResponse({ status: 401, description: 'Invalid Supabase token' })
  async supabaseAuth(@Body() dto: SupabaseAuthDto, @Request() req: any) {
    return this.authService.supabaseAuth(dto, req.headers['user-agent']);
  }

  @Post('social')
  @Throttle({ default: { limit: 30, ttl: 300000 } })
  @ApiOperation({ summary: 'Authenticate with Apple or Google' })
  @ApiResponse({ status: 200, description: 'Social auth successful' })
  @ApiResponse({ status: 401, description: 'Invalid social token' })
  async social(@Body() dto: SocialAuthDto, @Request() req: any) {
    return this.authService.socialAuth(dto, req.headers['user-agent']);
  }

  @Post('forgot-password')
  // Reset mail is sent on the platform's dime to an address the caller picks.
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({
    status: 200,
    description: 'Reset email sent if account exists',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If an account exists, a reset link has been sent' };
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({
    status: 400,
    description: 'Invalid/expired token or breached password',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.new_password);
    return { message: 'Password reset successfully' };
  }

  @Get('profile')
  @ApiBearerAuth('JWT')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Patch('profile')
  @ApiBearerAuth('JWT')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(
    @Request() req: any,
    @Body() updates: { name?: string; phone?: string },
  ) {
    return this.authService.updateProfile(req.user.id, updates);
  }

  @Post('consent/biometric')
  @ApiBearerAuth('JWT')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 1, ttl: 86400000 } })
  @ApiOperation({
    summary: 'Accept biometric data collection consent (Texas BUIA)',
  })
  async acceptBiometricConsent(@Request() req: any) {
    return this.authService.acceptBiometricConsent(req.user.id);
  }

  @Patch('role')
  @ApiBearerAuth('JWT')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Switch user role (driver/rider/both)' })
  async switchRole(
    @Request() req: any,
    @Body('selected_role') selected_role: 'rider' | 'driver' | 'both',
  ) {
    return this.authService.switchRole(req.user.id, selected_role);
  }
}
