import {
  IsEmail,
  IsString,
  MinLength,
  IsDateString,
  IsOptional,
  IsPhoneNumber,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums';

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsDateString()
  dob!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    enum: ['rider', 'driver', 'both'],
    description: 'User role preference',
  })
  @IsEnum(['rider', 'driver', 'both'])
  @IsOptional()
  selected_role?: 'rider' | 'driver' | 'both';
}

export class LoginDto {
  @ApiProperty({ description: 'Email or phone number' })
  @IsString()
  identifier!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  token!: string;
}

export class VerifyPhoneDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  phone!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refresh_token!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  new_password!: string;
}

export class SignupDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  phone!: string;
}

export class OtpVerifyDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsString()
  code!: string;
}

export class SupabaseAuthDto {
  @ApiProperty()
  @IsString()
  access_token!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MinLength(2)
  name?: string;
}

export class SocialAuthDto {
  @ApiProperty({ enum: ['apple', 'google'] })
  @IsEnum(['apple', 'google'])
  provider!: 'apple' | 'google';

  @ApiProperty()
  @IsString()
  token!: string;
}

export class AddEmergencyContactDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsPhoneNumber()
  phone!: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty()
  @IsString()
  relationship!: string;
}

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: {
    id: string;
    email: string;
    phone: string | null;
    name: string;
    role: UserRole;
    is_email_verified: boolean;
    is_phone_verified: boolean;
    selected_role: 'rider' | 'driver' | 'both';
  };
}
