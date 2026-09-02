import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PrivacyService } from './privacy.service';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@ApiTags('privacy')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get('export')
  @ApiOperation({ summary: 'Export all personal data (CCPA right to access)' })
  @ApiResponse({
    status: 200,
    description: 'Personal data exported successfully',
  })
  async exportData(@Req() req: Request) {
    const userId = (req.user as { sub: string }).sub;
    const data = await this.privacyService.exportUserData(userId);
    return {
      message: 'Your data export is ready',
      exported_at: data.export_date,
      summary: data.export_summary,
      data,
    };
  }

  @Post('delete')
  @ApiOperation({
    summary: 'Request account deletion (CCPA/Texas — 30-day grace period)',
  })
  @ApiResponse({
    status: 200,
    description: 'Deletion scheduled with grace period',
  })
  async deleteData(@Req() req: Request, @Body() body: { reason?: string }) {
    const userId = (req.user as { sub: string }).sub;
    const reason = body.reason || 'User requested deletion';
    return this.privacyService.requestDeletion(userId, reason);
  }

  @Post('cancel-deletion')
  @ApiOperation({
    summary: 'Cancel a pending deletion request within grace period',
  })
  @ApiResponse({ status: 200, description: 'Deletion request cancelled' })
  async cancelDeletion(@Req() req: Request) {
    const userId = (req.user as { sub: string }).sub;
    return this.privacyService.cancelDeletion(userId);
  }
}
