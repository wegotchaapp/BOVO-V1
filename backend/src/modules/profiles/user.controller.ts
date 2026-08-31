import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';
import { ProfilesService } from '../profiles/profiles.service';
import { User } from '../../database/entities/user.entity';
import { Trip } from '../../database/entities/trip.entities';
import { Booking } from '../../database/entities/booking.entities';
import { Payout } from '../../database/entities/payment.entities';

class UpdateBioDto {
  @IsOptional()
  @IsString()
  bio?: string;
}

class UpdatePreferencesDto {
  @IsOptional()
  languages?: string[];
}

class UpdateTravelPreferencesDto {
  @IsOptional()
  @IsString()
  rider_conversation_style?: string;

  @IsOptional()
  @IsString()
  rider_music_preference?: string;

  @IsOptional()
  @IsString()
  rider_smoking_preference?: string;

  @IsOptional()
  @IsString()
  rider_pet_preference?: string;
}

class UpdateRoleDto {
  primary!: 'rider' | 'driver';
}

@ApiTags('user')
@Controller()
export class UserController {
  constructor(
    private readonly profilesService: ProfilesService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
  ) {}

  @Patch('user/profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update user profile (bio)' })
  async updateProfile(@Request() req: any, @Body() dto: UpdateBioDto) {
    if (dto.bio !== undefined) {
      await this.profilesService.updateProfile(req.user.id, { bio: dto.bio });
    }
    return { message: 'Profile updated' };
  }

  @Patch('user/preferences')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update user preferences (languages)' })
  async updatePreferences(
    @Request() req: any,
    @Body() dto: UpdatePreferencesDto,
  ) {
    if (dto.languages !== undefined) {
      await this.profilesService.updateProfile(req.user.id, {
        languages: dto.languages,
      });
    }
    return { message: 'Preferences updated' };
  }

  @Get('user/travel-preferences')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get user travel preferences' })
  async getTravelPreferences(@Request() req: any) {
    const user = await this.userRepo.findOne({
      where: { id: req.user.id },
      select: [
        'rider_conversation_style',
        'rider_music_preference',
        'rider_smoking_preference',
        'rider_pet_preference',
      ],
    });
    return {
      rider_conversation_style: user?.rider_conversation_style || null,
      rider_music_preference: user?.rider_music_preference || null,
      rider_smoking_preference: user?.rider_smoking_preference || null,
      rider_pet_preference: user?.rider_pet_preference || null,
    };
  }

  @Patch('user/travel-preferences')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update user travel preferences' })
  async updateTravelPreferences(
    @Request() req: any,
    @Body() dto: UpdateTravelPreferencesDto,
  ) {
    const update: any = {};
    if (dto.rider_conversation_style !== undefined)
      update.rider_conversation_style = dto.rider_conversation_style;
    if (dto.rider_music_preference !== undefined)
      update.rider_music_preference = dto.rider_music_preference;
    if (dto.rider_smoking_preference !== undefined)
      update.rider_smoking_preference = dto.rider_smoking_preference;
    if (dto.rider_pet_preference !== undefined)
      update.rider_pet_preference = dto.rider_pet_preference;
    if (Object.keys(update).length > 0) {
      await this.userRepo.update(req.user.id, update);
    }
    return { message: 'Travel preferences updated' };
  }

  @Patch('user/role')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Set primary role (rider/driver)' })
  async updateRole(@Request() req: any, @Body() dto: UpdateRoleDto) {
    await this.userRepo.update(req.user.id, { selected_role: dto.primary });
    return { selected_role: dto.primary };
  }

  @Get('driver/stats')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get driver dashboard stats' })
  async getDriverStats(@Request() req: any) {
    const profile = await this.profilesService.getProfile(req.user.id);
    const userId = req.user.id;

    const tripsPosted = await this.tripRepo.count({
      where: { driver_id: userId },
    });

    const activePosts = await this.tripRepo.find({
      where: { driver_id: userId, status: Not(In(['completed', 'cancelled'])) },
      select: [
        'id',
        'origin_metro',
        'dest_metro',
        'departure_date',
        'departure_time',
        'seats_available',
        'created_at',
        'status',
      ],
      order: { departure_date: 'ASC' },
      take: 10,
    });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const payoutsResult = await this.payoutRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.driver_id = :userId', { userId })
      .andWhere('p.created_at >= :start', { start: startOfMonth.toISOString() })
      .andWhere('p.status = :status', { status: 'paid' })
      .getRawOne();
    const savedThisMonth = parseFloat(payoutsResult?.total || '0');

    return {
      savedThisMonth,
      tripsPosted,
      rating: profile?.avg_rating || 5.0,
      activePosts: activePosts.map((p) => ({
        id: p.id,
        originMetro: p.origin_metro,
        destMetro: p.dest_metro,
        departureDate: p.departure_date,
        departureTime: p.departure_time,
        seatsRemaining: p.seats_available,
        status: p.status,
      })),
    };
  }

  @Get('legal/current-irs-rate')
  @ApiOperation({
    summary: 'Get current IRS mileage rate for cost-sharing calculation',
  })
  async getCurrentIrsRate() {
    return { rate: 0.7, year: 2026, source: 'IRS Publication 463' };
  }

  @Get('user/me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current user profile with subscription info' })
  async getMe(@Request() req: any) {
    const user = await this.userRepo.findOne({
      where: { id: req.user.id },
      select: [
        'id',
        'email',
        'phone',
        'name',
        'role',
        'selected_role',
        'is_email_verified',
        'is_phone_verified',
        'subscription_tier',
        'subscription_expires_at',
        'rider_conversation_style',
        'rider_music_preference',
        'rider_smoking_preference',
        'rider_pet_preference',
      ],
    });
    return user;
  }

  @Post('subscription/verify-receipt')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Verify App Store receipt and activate Travel+' })
  async verifyReceipt(
    @Request() req: any,
    @Body() body: { receipt_data: string; product_id: string },
  ) {
    const environment = process.env.APP_STORE_ENV || 'sandbox';
    const url =
      environment === 'production'
        ? 'https://buy.itunes.apple.com/verifyReceipt'
        : 'https://sandbox.itunes.apple.com/verifyReceipt';

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': body.receipt_data,
        password: process.env.APP_STORE_SHARED_SECRET || '',
        exclude_old_transactions: true,
      }),
    });

    const result = await response.json();

    if (result.status !== 0 && result.status !== 21006) {
      throw new BadRequestException('Invalid receipt');
    }

    const receipt = result.receipt;
    const latestIap = receipt.in_app?.[receipt.in_app.length - 1];
    const originalTxId =
      latestIap?.original_transaction_id || receipt.receipt_creation_date;

    const expiresAt = latestIap?.expires_date
      ? new Date(latestIap.expires_date).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString();

    await this.userRepo.update(req.user.id, {
      subscription_tier: 'premium' as any,
      subscription_expires_at: expiresAt,
      subscription_apple_original_transaction_id: originalTxId,
    });

    return {
      tier: 'premium',
      expires_at: expiresAt,
      message: 'Travel+ activated',
    };
  }

  @Post('subscription/app-store-notification')
  @ApiOperation({ summary: 'App Store Server Notification webhook (no auth)' })
  async handleAppStoreNotification(@Body() body: any) {
    const signedPayload = body.signedPayload;
    if (!signedPayload) {
      throw new BadRequestException('Missing signedPayload');
    }

    let payload: any;
    try {
      const parts = signedPayload.split('.');
      const decoded = Buffer.from(parts[1], 'base64').toString('utf8');
      payload = JSON.parse(decoded);
    } catch {
      throw new BadRequestException('Invalid signedPayload');
    }

    const notificationType = payload.notificationType;
    const originalTxId =
      payload.data?.originalTransactionId ||
      payload.signedTransactionInfo?.originalTransactionId;

    if (!originalTxId) return { received: true };

    const user = await this.userRepo.findOne({
      where: { subscription_apple_original_transaction_id: originalTxId },
      select: ['id', 'subscription_tier'],
    });

    if (!user) return { received: true };

    switch (notificationType) {
      case 'DID_RENEW':
      case 'SUBSCRIBED':
      case 'INTERACTIVE_RENEWAL': {
        const expiresMs =
          payload.data?.signedTransactionInfo?.expiresDate ||
          payload.renewalInfo?.expiresDate;
        await this.userRepo.update(user.id, {
          subscription_tier: 'premium' as any,
          subscription_expires_at: expiresMs
            ? new Date(parseInt(expiresMs, 10)).toISOString()
            : new Date(Date.now() + 30 * 86400000).toISOString(),
        });
        break;
      }
      case 'DID_FAIL_TO_RENEW':
      case 'EXPIRED':
      case 'REVOKE':
      case 'CANCEL': {
        await this.userRepo.update(user.id, {
          subscription_tier: 'free' as any,
          subscription_expires_at: null,
        });
        break;
      }
    }

    return { received: true };
  }
}
