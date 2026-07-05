import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileAuthService } from '../services/mobile-auth.service';
import {
  LoginBody,
  NotificationSettingsBody,
  OAuthLoginBody,
  RegisterBody,
  UpdateMeBody,
} from '../dto/mobile.dto';
import {
  MobileAuthGuard,
  MobileAuthUser,
  extractBearer,
} from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/auth')
export class MobileAuthController {
  constructor(private readonly auth: MobileAuthService) {}

  @Post('register')
  register(@Body() dto: RegisterBody) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginBody) {
    return this.auth.login(dto);
  }

  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  oauth(@Body() dto: OAuthLoginBody) {
    return this.auth.oauthLogin(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: any) {
    return this.auth.logout(extractBearer(req));
  }

  @Get('me')
  @UseGuards(MobileAuthGuard)
  me(@MobileAuthUser() user: MobileUser) {
    return this.auth.me(user);
  }

  @Patch('me')
  @UseGuards(MobileAuthGuard)
  patchMe(@MobileAuthUser() user: MobileUser, @Body() dto: UpdateMeBody) {
    return this.auth.patchMe(user, dto);
  }

  @Put('me/notifications')
  @UseGuards(MobileAuthGuard)
  updateNotifications(
    @MobileAuthUser() user: MobileUser,
    @Body() dto: NotificationSettingsBody,
  ) {
    return this.auth.updateNotificationSettings(user, dto);
  }

  @Post('account/delete')
  @UseGuards(MobileAuthGuard)
  @HttpCode(HttpStatus.OK)
  requestDeletion(@MobileAuthUser() user: MobileUser, @Req() req: any) {
    return this.auth.requestDeletion(user, extractBearer(req));
  }

  @Post('account/cancel-deletion')
  @UseGuards(MobileAuthGuard)
  @HttpCode(HttpStatus.OK)
  cancelDeletion(@MobileAuthUser() user: MobileUser) {
    return this.auth.cancelDeletion(user);
  }
}
