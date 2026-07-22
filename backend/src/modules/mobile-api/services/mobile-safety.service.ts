import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Twilio } from 'twilio';
import { MobileUser } from '../entities/mobile.entities';
import { SosBody } from '../dto/mobile.dto';

/**
 * Server side of the SOS flow. The device handles the 911 call/text (OS rules
 * forbid auto-dialing); this service automatically texts the user's emergency
 * contact (collected at onboarding) with their live location via Twilio.
 */
@Injectable()
export class MobileSafetyService {
  private readonly logger = new Logger(MobileSafetyService.name);
  private readonly twilio: Twilio | null;

  constructor(
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
    private readonly config: ConfigService,
  ) {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.twilio = sid && token ? new Twilio(sid, token) : null;
  }

  async activateSos(userId: string, dto: SosBody) {
    const user = await this.users.findOne({ where: { id: userId } });
    const contactPhone = user?.emergency_phone?.trim() || null;

    this.logger.warn(
      `SOS activated by user ${userId}` +
        (dto.tripId ? ` (trip ${dto.tripId})` : '') +
        (dto.latitude != null && dto.longitude != null
          ? ` at ${dto.latitude},${dto.longitude}`
          : ' (no location)'),
    );

    if (!contactPhone) {
      // The device-side 911 flow proceeds regardless.
      return { ok: true, contactNotified: false, reason: 'no_emergency_contact' };
    }

    const locationLine =
      dto.latitude != null && dto.longitude != null
        ? ` Live location: https://www.google.com/maps?q=${dto.latitude},${dto.longitude}.`
        : ' Location unavailable.';
    const message =
      `EMERGENCY: ${user?.name ?? 'A Bovogo user'} triggered an SOS alert on Bovogo and needs help.` +
      locationLine +
      ' If you cannot reach them, contact local authorities.';

    const fromNumber = this.config.get<string>('TWILIO_PHONE_NUMBER');
    if (!this.twilio || !fromNumber) {
      this.logger.error('Twilio not configured; emergency contact SMS skipped');
      return { ok: true, contactNotified: false, reason: 'sms_unavailable' };
    }

    try {
      const result = await this.twilio.messages.create({
        body: message,
        from: fromNumber,
        to: contactPhone,
      });
      this.logger.warn(
        `SOS SMS sent to emergency contact (sid ${result.sid}, status ${result.status})`,
      );
      return { ok: true, contactNotified: true };
    } catch (err) {
      this.logger.error(
        `SOS SMS to emergency contact failed: ${err instanceof Error ? err.message : err}`,
      );
      return { ok: true, contactNotified: false, reason: 'sms_failed' };
    }
  }
}
