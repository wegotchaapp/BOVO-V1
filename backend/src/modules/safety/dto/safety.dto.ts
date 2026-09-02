import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportCategory, SosTriggerType } from '../../../common/enums';
import { Type } from 'class-transformer';

export class SubmitReportDto {
  @ApiProperty()
  @IsString()
  reported_user_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  booking_id?: string;

  @ApiProperty({ enum: ReportCategory })
  @IsEnum(ReportCategory)
  category!: ReportCategory;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidence_photo_url?: string;
}

export class ModerationActionDto {
  @ApiProperty()
  @IsString()
  report_id!: string;

  @ApiProperty({
    enum: [
      'dismiss',
      'warning',
      'temp_suspension',
      'permanent_ban',
      'law_enforcement_referral',
    ],
  })
  @IsString()
  action_type!: string;

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence_refs?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  suspension_days?: number;
}

export class SubmitAppealDto {
  @ApiProperty()
  @IsString()
  action_id!: string;

  @ApiProperty()
  @IsString()
  description!: string;
}

export class SosActivationDto {
  @ApiProperty({ enum: SosTriggerType })
  @IsEnum(SosTriggerType)
  trigger_type!: SosTriggerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  booking_id?: string;
}

export class TripPingDto {
  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  latitude!: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  longitude!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  accuracy?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  battery_level?: number;
}
