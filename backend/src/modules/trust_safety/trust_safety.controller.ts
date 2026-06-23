import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, Ip, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TrustSafetyService } from './trust_safety.service';
import { SubmitReportDto, ModerationActionDto, SubmitAppealDto, ReviewAppealDto } from '../../common/dto/trust-safety.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { UserRole } from '../../common/enums';

@ApiTags('trust-safety')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Controller('trust-safety')
export class TrustSafetyController {
  constructor(private readonly tsService: TrustSafetyService) {}

  @Post('reports')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Submit a report against a user' })
  async submitReport(@Request() req: any, @Body() dto: SubmitReportDto) {
    return this.tsService.submitReport(req.user.id, dto);
  }

  @Get('reports/my')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get my reports' })
  async getMyReports(@Request() req: any) {
    return this.tsService.getMyReports(req.user.id);
  }

  @Get('admin/moderation/queue')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.TS_AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get moderation queue (ts_agent only)' })
  async getQueue(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.tsService.getModerationQueue(
      parseInt(String(page)) || 1,
      parseInt(String(limit)) || 50,
    );
  }

  @Get('admin/moderation/reports/:id')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.TS_AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get full report detail with context' })
  async getReportDetail(@Param('id') id: string) {
    return this.tsService.getReportDetail(id);
  }

  @Post('admin/moderation/actions')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.TS_AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Log a moderation action (ts_agent only)' })
  async takeAction(
    @Request() req: any,
    @Body() dto: ModerationActionDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.tsService.takeModerationAction(req.user.id, dto, ip, ua);
  }

  @Post('appeals')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Submit an appeal against a moderation action' })
  async submitAppeal(@Request() req: any, @Body() dto: SubmitAppealDto) {
    return this.tsService.submitAppeal(req.user.id, dto);
  }

  @Post('admin/appeals/:id/review')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.TS_AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Review an appeal (ts_agent only — different from original agent)' })
  async reviewAppeal(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ReviewAppealDto,
  ) {
    return this.tsService.reviewAppeal(req.user.id, id, dto.decision, dto.decision_reason);
  }

  @Get('appeals')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get my appeals' })
  async getMyAppeals(@Request() req: any) {
    return this.tsService.getUserAppeals(req.user.id);
  }

  @Get('my/suspension-status')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Check if current user is suspended' })
  async checkSuspension(@Request() req: any) {
    return this.tsService.isUserSuspended(req.user.id);
  }
}
