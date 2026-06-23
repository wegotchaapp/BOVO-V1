import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UseFilters } from '@nestjs/common';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileGroupsService } from '../services/mobile-groups.service';
import { GroupMessageBody } from '../dto/mobile.dto';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/groups')
@UseGuards(MobileAuthGuard)
export class MobileGroupsController {
  constructor(private readonly groups: MobileGroupsService) {}

  @Get('mine')
  mine(@MobileAuthUser() user: MobileUser) {
    return this.groups.mine(user.id);
  }

  @Get(':id')
  detail(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.groups.detail(user.id, id);
  }

  @Post(':id/messages')
  postMessage(
    @MobileAuthUser() user: MobileUser,
    @Param('id') id: string,
    @Body() dto: GroupMessageBody,
  ) {
    return this.groups.postMessage(user.id, id, dto);
  }

  @Delete(':id')
  remove(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.groups.remove(user.id, id);
  }
}
