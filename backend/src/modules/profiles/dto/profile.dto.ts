import {
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
  IsUrl,
  IsEnum,
  IsObject,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleCategory } from '../../../common/enums';

export class UploadPhotoDto {
  @ApiProperty()
  @IsUrl()
  url!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  display_name?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  profile_photo_url?: string;
}

export class RegisterVehicleDto {
  @ApiProperty()
  @IsString()
  make!: string;

  @ApiProperty()
  @IsString()
  model!: string;

  @ApiProperty()
  @IsString()
  year!: string;

  @ApiProperty()
  @IsString()
  color!: string;

  @ApiProperty()
  @IsString()
  license_plate!: string;

  @ApiProperty()
  @IsString()
  state!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vin?: string;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  make?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  year?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  license_plate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ enum: VehicleCategory })
  @IsOptional()
  @IsEnum(VehicleCategory)
  category?: VehicleCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  max_luggage_class?: string;

  @ApiPropertyOptional()
  @IsOptional()
  max_passengers?: number;
}

export class VehiclePhotoDto {
  @ApiProperty({
    enum: ['front_exterior', 'rear_exterior', 'driver_side', 'interior'],
  })
  @IsString()
  photo_type!: string;

  @ApiProperty()
  @IsString()
  base64_image!: string;

  @ApiProperty()
  @IsString()
  mime_type!: string;
}

export class VehicleDocumentDto {
  @ApiProperty({ enum: ['registration', 'insurance'] })
  @IsString()
  doc_type!: string;

  @ApiProperty()
  @IsString()
  base64_image!: string;

  @ApiProperty()
  @IsString()
  mime_type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expires_at?: string;
}
