import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AdminGuard } from './admin.guard';
import { IdentityReviewService } from './identity-review.service';

type AdminRequest = Request & { user: { id: string } };

@ApiTags('admin')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('admin/identity-verifications')
export class IdentityReviewController {
  constructor(private readonly review: IdentityReviewService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
  ) {
    return this.review.list(status, page);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.review.detail(id);
  }

  @Get(':id/files/:slot')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async file(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slot') slot: string,
    @Req() req: AdminRequest,
  ) {
    const file = await this.review.file(id, slot, req.user.id);
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: 'inline; filename="verification-image"',
      length: file.body.length,
    });
  }

  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @Req() req: AdminRequest) {
    return this.review.decide(id, req.user.id, true);
  }

  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AdminRequest,
    @Body('note') note?: unknown,
  ) {
    return this.review.decide(id, req.user.id, false, note);
  }
}
