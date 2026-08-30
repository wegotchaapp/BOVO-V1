import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  IsDateString,
  IsBoolean,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ConversationStyle,
  MusicPreference,
  SmokingPreference,
  PetPreference,
  LuggageCapacity,
  TripStatus,
} from '../../../common/enums';

export class CreateTripDto {
  @ApiProperty()
  @IsString()
  origin_metro!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  origin_pickup_zones!: string[];

  @ApiProperty()
  @IsString()
  dest_metro!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  dest_dropoff_zones!: string[];

  @ApiProperty()
  @IsDateString()
  departure_date!: string;

  @ApiProperty()
  @IsString()
  departure_time!: string;

  @ApiPropertyOptional({ default: '+/- 30 min' })
  @IsOptional()
  @IsString()
  departure_time_window?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(3)
  seats_available!: number;

  @ApiProperty()
  @IsString()
  vehicle_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(ConversationStyle)
  conversation?: ConversationStyle;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MusicPreference)
  music?: MusicPreference;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(SmokingPreference)
  smoking?: SmokingPreference;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(PetPreference)
  pets?: PetPreference;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  women_only?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(LuggageCapacity)
  luggage_capacity?: LuggageCapacity;
}

export class UpdateTripPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(ConversationStyle)
  conversation?: ConversationStyle;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MusicPreference)
  music?: MusicPreference;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(SmokingPreference)
  smoking?: SmokingPreference;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(PetPreference)
  pets?: PetPreference;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  women_only?: boolean;
}

export class UpdateTripDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  departure_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departure_time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  preferences?: UpdateTripPreferencesDto;
}

export class SearchTripsDto {
  @ApiProperty()
  @IsString()
  origin_metro!: string;

  @ApiProperty()
  @IsString()
  dest_metro!: string;

  @ApiProperty()
  @IsDateString()
  travel_date!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  seats_needed?: number;

  @ApiPropertyOptional({
    enum: ['best_match', 'earliest', 'lowest_price', 'highest_rated'],
    default: 'best_match',
  })
  @IsOptional()
  @IsString()
  sort?: 'best_match' | 'earliest' | 'lowest_price' | 'highest_rated';

  @ApiPropertyOptional({ enum: ['soft', 'hard'], default: 'soft' })
  @IsOptional()
  @IsString()
  filter_mode?: 'soft' | 'hard';

  @ApiPropertyOptional({ enum: ConversationStyle })
  @IsOptional()
  @IsEnum(ConversationStyle)
  conversation_style?: ConversationStyle;

  @ApiPropertyOptional({ enum: MusicPreference })
  @IsOptional()
  @IsEnum(MusicPreference)
  music_preference?: MusicPreference;

  @ApiPropertyOptional({ enum: SmokingPreference })
  @IsOptional()
  @IsEnum(SmokingPreference)
  smoking_preference?: SmokingPreference;

  @ApiPropertyOptional({ enum: PetPreference })
  @IsOptional()
  @IsEnum(PetPreference)
  pet_preference?: PetPreference;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  women_only?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicle_category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  verified_drivers_only?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  luggage_capacity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  min_rating?: number;
}

export class CreateReplyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;
}

export class SaveSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty()
  @IsString()
  origin_metro!: string;

  @ApiProperty()
  @IsString()
  dest_metro!: string;

  @ApiProperty()
  @IsDateString()
  travel_date!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  seats_needed?: number;

  @ApiPropertyOptional({ enum: ConversationStyle })
  @IsOptional()
  @IsEnum(ConversationStyle)
  conversation_style?: ConversationStyle;

  @ApiPropertyOptional({ enum: MusicPreference })
  @IsOptional()
  @IsEnum(MusicPreference)
  music_preference?: MusicPreference;

  @ApiPropertyOptional({ enum: SmokingPreference })
  @IsOptional()
  @IsEnum(SmokingPreference)
  smoking_preference?: SmokingPreference;

  @ApiPropertyOptional({ enum: PetPreference })
  @IsOptional()
  @IsEnum(PetPreference)
  pet_preference?: PetPreference;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  women_only?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  strict_filters?: boolean;

  @ApiPropertyOptional({ default: 'best_match' })
  @IsOptional()
  @IsString()
  sort_by?: string;
}
