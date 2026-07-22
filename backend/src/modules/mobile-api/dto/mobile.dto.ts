import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterBody {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(32)
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

export class LoginBody {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class OAuthLoginBody {
  @IsIn(['google', 'apple'])
  provider!: 'google' | 'apple';

  @IsString()
  @MinLength(10)
  idToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class NotificationSettingsBody {
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  tripUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing?: boolean;

  @IsOptional()
  @IsBoolean()
  messages?: boolean;
}

export class UpdateMeBody {
  @IsOptional()
  @IsIn(['driver', 'rider'])
  role?: 'driver' | 'rider';

  @IsOptional()
  @IsBoolean()
  onboarded?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsObject()
  ridePreferences?: Record<string, string>;
}

export class SosBody {
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tripId?: string;
}

export class UpsertVehicleBody {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  make!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  model!: string;

  @IsInt()
  @Min(1980)
  @Max(2100)
  year!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  color!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  licensePlate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  vin?: string;
}

export class SubmitRatingBody {
  @IsString()
  bookingId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpsertPreferencesBody {
  @IsObject()
  preferences!: Record<string, string>;
}

export class TripPreferencesDto {
  @IsOptional()
  @IsBoolean()
  smoking?: boolean;

  @IsOptional()
  @IsBoolean()
  pets?: boolean;

  @IsOptional()
  @IsBoolean()
  music?: boolean;

  @IsOptional()
  @IsBoolean()
  ac?: boolean;
}

export class CreateTripBody {
  @IsString()
  @MaxLength(120)
  fromCity!: string;

  @IsString()
  @MaxLength(120)
  toCity!: string;

  @IsString()
  departureAt!: string;

  @IsInt()
  @Min(1)
  @Max(8)
  seatsAvailable!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  luggageSpace?: number;

  @IsNumber()
  @Min(0)
  pricePerSeat!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  car?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TripPreferencesDto)
  preferences?: TripPreferencesDto;
}

export class CreateReplyBody {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}

export class CreateBookingBody {
  @IsString()
  tripId!: string;

  @IsInt()
  @Min(1)
  @Max(8)
  seats!: number;

  @IsIn(['card', 'apple', 'venmo'])
  paymentMethod!: 'card' | 'apple' | 'venmo';
}

export class ConfirmBookingBody {
  @IsString()
  bookingId!: string;
}

export class OpenConversationBody {
  @IsString()
  otherUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tripLabel?: string;
}

export class LiveLocationBody {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsNumber()
  heading?: number;

  @IsOptional()
  @IsNumber()
  speed?: number;
}

export class GroupMessageBody {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}
