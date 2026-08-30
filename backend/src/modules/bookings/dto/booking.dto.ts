import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { LuggageType } from '../../../common/enums';

export class LuggageItemDto {
  @ApiProperty({ enum: LuggageType })
  @IsEnum(LuggageType)
  type!: LuggageType;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  qty!: number;
}

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  trip_id!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  seats!: number;

  @ApiProperty({ type: [LuggageItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LuggageItemDto)
  luggage!: LuggageItemDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  insurance_opted_in?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  luggage_insurance_opted_in?: boolean;
}

export class CancelBookingDto {
  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  safety_reason?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  cancelled_by_driver?: boolean;
}
