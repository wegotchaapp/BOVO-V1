import { Controller, Get, Post, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ComplianceService } from './compliance.service';

@ApiTags('compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('logs')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: "Get current user's compliance logs" })
  async getLogs(@Request() req: any, @Query('limit') limit?: number) {
    return this.complianceService.getLogs(req.user.sub, limit ? parseInt(String(limit)) : undefined);
  }

  @Post('logs')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create a compliance log entry' })
  async createLog(
    @Request() req: any,
    @Body('rule') rule: string,
    @Body('action') action: string,
    @Body('details') details?: string,
  ) {
    return this.complianceService.log(req.user.sub, rule, action, details);
  }
}
