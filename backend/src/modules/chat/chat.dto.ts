import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
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
