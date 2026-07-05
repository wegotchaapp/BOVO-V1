import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileConversationsService } from '../services/mobile-conversations.service';
import { GroupMessageBody, OpenConversationBody } from '../dto/mobile.dto';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/conversations')
@UseGuards(MobileAuthGuard)
export class MobileConversationsController {
  constructor(private readonly conversations: MobileConversationsService) {}

  @Get('mine')
  mine(@MobileAuthUser() user: MobileUser) {
    return this.conversations.mine(user.id);
  }

  @Post('support')
  @HttpCode(HttpStatus.OK)
  support(@MobileAuthUser() user: MobileUser) {
    return this.conversations.openSupport(user.id);
  }

  @Post()
  open(@MobileAuthUser() user: MobileUser, @Body() dto: OpenConversationBody) {
    return this.conversations.openWith(
      user.id,
      dto.otherUserId,
      dto.tripLabel,
    );
  }

  @Get(':id')
  detail(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.conversations.detail(user.id, id);
  }

  @Post(':id/messages')
  postMessage(
    @MobileAuthUser() user: MobileUser,
    @Param('id') id: string,
    @Body() dto: GroupMessageBody,
  ) {
    return this.conversations.postMessage(user.id, id, dto.text);
  }
}
