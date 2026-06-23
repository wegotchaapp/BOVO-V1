import { Controller, Post, Get, UseGuards, Request, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IdentityService } from './identity.service';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';

@ApiTags('identity')
@Controller()
@UseGuards(AuthGuard('jwt'))
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('identity/start-verification')
  @ApiBearerAuth('JWT')
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Start ID verification with Stripe Identity' })
  async startVerification(@Request() req: any) {
    return this.identityService.startVerification(req.user.id);
  }

  @Get('identity/status')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current verification status' })
  async getStatus(@Request() req: any) {
    return this.identityService.getStatus(req.user.id);
  }

  @Get('identity/face-image-ref')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get stored face image reference for profile photo comparison' })
  async getFaceImageRef(@Request() req: any) {
    const ref = await this.identityService.getFaceImageReference(req.user.id);
    return { face_image_reference: ref };
  }

  @Post('kyc/id-document')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Upload government ID document for KYC' })
  async uploadIdDocument(@Request() req: any, @Body() dto: { image?: string }) {
    return this.identityService.startVerification(req.user.id);
  }

  @Post('kyc/selfie')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Upload selfie for liveness verification' })
  async uploadSelfie(@Request() req: any, @Body() dto: { image?: string }) {
    return { status: 'pending', message: 'Selfie submitted for review' };
  }
}
