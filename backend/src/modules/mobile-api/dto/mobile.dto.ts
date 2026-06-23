import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
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

export class GroupMessageBody {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}
