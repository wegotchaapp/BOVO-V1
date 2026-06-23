import { IsString, IsNotEmpty, IsOptional, IsInt, IsEnum, IsUrl, MaxLength, Min, Max, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

export class SubmitRatingDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsString({ each: true })
  @IsOptional()
  @ArrayMaxSize(10)
  tags?: string[];
}

export class BlockUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  blocked_user_id!: string;
}

export class InitiateCallResponse {
  @ApiProperty()
  proxy_number!: string;

  @ApiProperty()
  call_sid!: string;

  @ApiProperty()
  receiver_first_name!: string;
}

export class PaginatedMessages {
  @ApiProperty({ type: [Object] })
  messages!: any[];

  @ApiProperty()
  has_more!: boolean;

  @ApiPropertyOptional()
  next_cursor?: string;
}

export class ConversationSummary {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  booking_id!: string;

  @ApiProperty()
  other_user!: { id: string; name: string };

  @ApiProperty({ nullable: true })
  last_message!: string | null;

  @ApiProperty({ nullable: true })
  last_message_at!: string | null;

  @ApiProperty()
  unread_count!: number;

  @ApiProperty()
  is_upcoming!: boolean;

  @ApiProperty()
  booking_status!: string;

  @ApiProperty()
  trip_details!: {
    origin_metro?: string;
    dest_metro?: string;
    departure_date?: string;
    departure_time?: string;
  };
}
