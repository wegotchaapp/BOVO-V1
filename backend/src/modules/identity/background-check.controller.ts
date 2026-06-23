import { Controller, Get, Post, Body, UseGuards, Request, Ip, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CheckrService, FcraConsentDto, BackgroundCheckInitDto } from './checkr.service';

@ApiTags('drivers')
@Controller('drivers/background-check')
export class BackgroundCheckController {
  constructor(private readonly checkrService: CheckrService) {}

  @Post('accept-fcra-disclosure')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Accept FCRA disclosure' })
  async acceptFcraDisclosure(
    @Request() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.checkrService.acceptFcraDisclosure(req.user.id, {
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  }

  @Post('initiate')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Initiate background check' })
  async initiate(@Request() req: any, @Body() dto: BackgroundCheckInitDto) {
    return this.checkrService.initiateBackgroundCheck(req.user.id, dto);
  }

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get background check status' })
  async getStatus(@Request() req: any) {
    return this.checkrService.getStatus(req.user.id);
  }
}