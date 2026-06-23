import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UseFilters } from '@nestjs/common';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileAuthService } from '../services/mobile-auth.service';
import { LoginBody, RegisterBody, UpdateMeBody } from '../dto/mobile.dto';
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
}
