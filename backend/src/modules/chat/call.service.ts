import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CallRecord } from '../../database/entities/chat.entities';
import { Booking } from '../../database/entities/booking.entities';
import { User } from '../../database/entities/user.entity';
import { PinoLogger } from 'nestjs-pino';
import { Twilio } from 'twilio';

@Injectable()
export class MaskedCallService {
  private twilio: Twilio;
  private twilioPhoneNumber: string;

  constructor(
    @InjectRepository(CallRecord)
    private readonly callRecordRepo: Repository<CallRecord>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.twilio = new Twilio(
      this.config.get('TWILIO_ACCOUNT_SID'),
      this.config.get('TWILIO_AUTH_TOKEN'),
    );
    this.twilioPhoneNumber = this.config.get('TWILIO_PHONE_NUMBER') || '';
  }

  async initiateCall(
    userId: string,
    bookingId: string,
  ): Promise<{ proxy_number: string; target_number: string; call_sid: string }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });

    if (!booking) throw new BadRequestException('Booking not found');

    if (!['confirmed', 'en_route', 'in_progress'].includes(booking.status)) {
      throw new BadRequestException('Calls are only available for active trips');
    }

    const driverId = booking.trip?.driver_id;
    const riderId = booking.rider_id;

    if (userId !== driverId && userId !== riderId) {
      throw new BadRequestException('You are not a participant in this booking');
    }

    const caller = await this.userRepo.findOne({ where: { id: userId } });
    if (!caller?.phone) throw new BadRequestException('Your phone number is not registered');

    const targetUserId = userId === driverId ? riderId : driverId;
    const targetUser = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!targetUser?.phone) throw new BadRequestException('Counterparty phone number not available');

    let proxyNumber = this.config.get('TWILIO_PROXY_NUMBER');

    if (!proxyNumber) {
      try {
        const phone = await this.twilio.incomingPhoneNumbers.create({
          phoneNumber: this.twilioPhoneNumber,
          voiceUrl: `https://handler.twilio.com/twiml/EH${bookingId}`,
          friendlyName: `Bovogo Proxy - ${bookingId}`,
        });

        proxyNumber = phone.phoneNumber;
      } catch (err) {
        this.logger.warn({ err, bookingId }, 'Failed to create Twilio proxy number');
        proxyNumber = this.twilioPhoneNumber;
      }
    }

    try {
      const call = await this.twilio.calls.create({
        url: this.buildTwimlUrl(proxyNumber!, targetUser.phone),
        to: caller.phone,
        from: proxyNumber!,
        statusCallback: `${this.config.get('APP_URL')}/chat/calls/webhook/${bookingId}`,
        statusCallbackMethod: 'POST',
      });

      const callRecord = this.callRecordRepo.create({
        booking_id: bookingId,
        caller_id: userId,
        twilio_call_sid: call.sid,
      });

      await this.callRecordRepo.save(callRecord);

      this.logger.info(
        { callSid: call.sid, callerId: userId, bookingId },
        'Masked call initiated',
      );

      return {
        proxy_number: proxyNumber!,
        target_number: targetUser.phone,
        call_sid: call.sid,
      };
    } catch (err) {
      this.logger.error({ err, bookingId }, 'Failed to initiate masked call');
      throw new BadRequestException('Failed to initiate call. Please try again.');
    }
  }

  async handleCallWebhook(bookingId: string, payload: any): Promise<void> {
    const { CallSid, CallDuration, CallStatus } = payload;

    const callRecord = await this.callRecordRepo.findOne({
      where: { twilio_call_sid: CallSid },
    });

    if (callRecord) {
      if (CallDuration) {
        await this.callRecordRepo.update(callRecord.id, {
          duration_seconds: parseInt(CallDuration, 10),
        });
      }

      this.logger.info(
        { bookingId, callSid: CallSid, status: CallStatus, duration: CallDuration },
        'Masked call webhook received',
      );
    }
  }

  private buildTwimlUrl(proxyNumber: string, targetNumber: string): string {
    return `https://handler.twilio.com/twiml?To=${encodeURIComponent(targetNumber)}&From=${encodeURIComponent(proxyNumber)}`;
  }
}
