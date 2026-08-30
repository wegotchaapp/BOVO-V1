import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import {
  UpdateProfileDto,
  RegisterVehicleDto,
  UploadPhotoDto,
  UpdateVehicleDto,
  VehiclePhotoDto,
  VehicleDocumentDto,
} from './dto/profile.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get my profile' })
  async getMyProfile(@Request() req: any) {
    const profile = await this.profilesService.getProfile(req.user.id);
    const badges = await this.profilesService.computeBadges(req.user.id);
    return { ...profile, badges };
  }

  @Put('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update my profile' })
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.profilesService.updateProfile(req.user.id, dto);
  }

  @Post('photo')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Upload profile photo (URL)' })
  async uploadPhoto(@Request() req: any, @Body() dto: UploadPhotoDto) {
    return this.profilesService.uploadProfilePhoto(req.user.id, dto.url);
  }

  @Post('photo/base64')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Upload profile photo (base64)' })
  async uploadPhotoBase64(
    @Request() req: any,
    @Body() dto: { image: string; mime_type: string },
  ) {
    return this.profilesService.uploadProfilePhotoFromBase64(
      req.user.id,
      dto.image,
      dto.mime_type,
    );
  }

  @Get('badges')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get my earned badges' })
  async getMyBadges(@Request() req: any) {
    const badges = await this.profilesService.computeBadges(req.user.id);
    return { badges };
  }

  @Post('vehicles/decode-vin')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Decode VIN via NHTSA API' })
  async decodeVin(@Body() dto: { vin: string }) {
    return this.profilesService.decodeVin(dto.vin);
  }

  @Post('vehicles')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Register a new vehicle' })
  async registerVehicle(@Request() req: any, @Body() dto: RegisterVehicleDto) {
    return this.profilesService.registerVehicle(req.user.id, dto);
  }

  @Get('vehicles')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List my vehicles' })
  async getVehicles(@Request() req: any) {
    return this.profilesService.getVehicles(req.user.id);
  }

  @Get('vehicles/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get a single vehicle' })
  async getVehicle(@Request() req: any, @Param('id') id: string) {
    return this.profilesService.getVehicle(req.user.id, id);
  }

  @Patch('vehicles/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Update vehicle info (including manual category override)',
  })
  async updateVehicle(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.profilesService.updateVehicle(req.user.id, id, dto);
  }

  @Post('vehicles/:id/photos')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Upload a vehicle photo (base64, with moderation)' })
  async uploadVehiclePhoto(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: VehiclePhotoDto,
  ) {
    return this.profilesService.uploadVehiclePhoto(
      req.user.id,
      id,
      dto.photo_type,
      dto.base64_image,
      dto.mime_type,
    );
  }

  @Post('vehicles/:id/documents')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Upload registration or insurance document' })
  async uploadVehicleDocument(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: VehicleDocumentDto,
  ) {
    return this.profilesService.uploadVehicleDocument(
      req.user.id,
      id,
      dto.doc_type,
      dto.base64_image,
      dto.mime_type,
      dto.expires_at,
    );
  }

  @Post('vehicles/:id/deactivate')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a vehicle' })
  async deactivateVehicle(@Request() req: any, @Param('id') id: string) {
    await this.profilesService.deactivateVehicle(req.user.id, id);
    return { message: 'Vehicle deactivated' };
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get public profile by user ID' })
  async getPublicProfile(@Param('userId') userId: string) {
    return this.profilesService.getPublicProfile(userId);
  }
}
