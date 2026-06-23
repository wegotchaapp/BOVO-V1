import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsUrl, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportCategory, ModerationActionType } from '../../common/enums';

export class SubmitReportDto {
  @ApiProperty({ enum: ReportCategory })
  @IsEnum(ReportCategory)
  @IsNotEmpty()
  category!: ReportCategory;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reported_user_id!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  booking_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @IsUrl()
  evidence_photo_url?: string;
}

export class ModerationActionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  report_id!: string;

  @ApiProperty({ enum: ModerationActionType })
  @IsEnum(ModerationActionType)
  @IsNotEmpty()
  action_type!: ModerationActionType;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsString({ each: true })
  @IsOptional()
  evidence_refs?: string[];

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(1)
  suspension_days?: number;
}

export class SubmitAppealDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  action_id!: string;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @IsUrl()
  evidence_url?: string;
}

export class ReviewAppealDto {
  @ApiProperty({ enum: ['granted', 'denied'] })
  @IsString()
  @IsNotEmpty()
  decision!: 'granted' | 'denied';

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  decision_reason!: string;
}
