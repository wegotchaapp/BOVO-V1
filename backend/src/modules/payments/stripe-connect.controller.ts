import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StripeConnectService, StripeOnboardDto } from './stripe-connect.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('payments')
@Controller('payments')
export class StripeConnectController {
  constructor(private readonly stripeConnectService: StripeConnectService) {}

  @Post('connect/onboard')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create Stripe Connect Express account and onboarding link' })
  async onboard(
    @Request() req: any,
    @Body() dto: StripeOnboardDto,
  ) {
    return this.stripeConnectService.onboardDriver(req.user.id, dto);
  }

  @Get('connect/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Check driver Connect onboarding status' })
  async status(@Request() req: any) {
    return this.stripeConnectService.getConnectStatus(req.user.id);
  }

  @Post('connect/refresh')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Generate fresh account link if previous expired' })
  async refresh(
    @Request() req: any,
    @Body() dto: { return_url: string; refresh_url: string },
  ) {
    return this.stripeConnectService.refreshAccountLink(
      req.user.id,
      dto.return_url,
      dto.refresh_url,
    );
  }

  @Get('connect/dashboard-link')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Generate Stripe Express Dashboard login link' })
  async dashboardLink(@Request() req: any) {
    return this.stripeConnectService.getDashboardLink(req.user.id);
  }

  @Get('my-payouts')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Get paginated list of driver payouts' })
  async myPayouts(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stripeConnectService.getMyPayouts(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('my-earnings')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get earnings summary (weekly, monthly, YTD, pending)' })
  async myEarnings(@Request() req: any) {
    return this.stripeConnectService.getMyEarnings(req.user.id);
  }

  @Get('ytd-threshold-status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Check cost-share compliance thresholds and guardrails' })
  async ytdThreshold(@Request() req: any) {
    return this.stripeConnectService.getYtdThresholdStatus(req.user.id);
  }

  @Get('compliance/trip-guardrail')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Check if driver can post another trip (6 trips/7 days limit)' })
  async tripGuardrail(@Request() req: any) {
    return this.stripeConnectService.checkTripComplianceGuardrail(req.user.id);
  }
}
