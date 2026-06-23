import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EmergencyContact } from '../../database/entities/communication.entities';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class EmergencyContactsService {
  constructor(
    @InjectRepository(EmergencyContact)
    private readonly contactRepo: Repository<EmergencyContact>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {}

  async addContact(
    userId: string,
    dto: { name: string; phone: string; email?: string; relationship: string },
  ): Promise<EmergencyContact> {
    const existing = await this.contactRepo.findOne({
      where: { user_id: userId, phone: dto.phone },
    });

    if (existing) {
      throw new BadRequestException('This contact already exists');
    }

    const contact = this.contactRepo.create({
      user_id: userId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email || null,
      relationship: dto.relationship,
      opted_in: false,
    });

    const saved = await this.contactRepo.save(contact);

    await this.sendOptInSms(saved);

    return saved;
  }

  async getContacts(userId: string): Promise<EmergencyContact[]> {
    return this.contactRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async removeContact(userId: string, contactId: string): Promise<void> {
    const contact = await this.contactRepo.findOne({
      where: { id: contactId, user_id: userId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    await this.contactRepo.softDelete(contactId);
  }

  async handleOptOut(phone: string): Promise<void> {
    const contact = await this.contactRepo.findOne({
      where: { phone, opted_in: true },
    });

    if (contact) {
      contact.opted_in = false;
      await this.contactRepo.save(contact);
      this.logger.info({ contactId: contact.id, phone }, 'Emergency contact opted out');
    }
  }

  async getActiveCount(userId: string): Promise<number> {
    return this.contactRepo.count({
      where: { user_id: userId, opted_in: true },
    });
  }

  private async sendOptInSms(contact: EmergencyContact): Promise<void> {
    const twilioSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const twilioPhone = this.config.get<string>('TWILIO_PHONE_NUMBER');

    if (!twilioSid || !twilioToken || !twilioPhone) {
      this.logger.warn(
        { contactId: contact.id },
        'Twilio not configured, skipping opt-in SMS',
      );
      return;
    }

    const message =
      `Hi ${contact.name}, ${this.getUserName(contact.user_id)} has added you as an ` +
      `emergency contact on Bovogo — our carpooling safety feature. Your contact ` +
      `info will only be used in real safety emergencies, and we'll never share it. ` +
      `You can opt out anytime by replying STOP to this message. ` +
      `Questions? Reach us at safety@bovogo.com`;

    try {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const body = new URLSearchParams();
      body.set('From', twilioPhone);
      body.set('To', contact.phone);
      body.set('Body', message);

      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      this.logger.info({ contactId: contact.id, phone: contact.phone }, 'Opt-in SMS sent');
    } catch (error) {
      this.logger.error(
        { contactId: contact.id, error },
        'Failed to send opt-in SMS',
      );
    }
  }

  private async getUserName(userId: string): Promise<string> {
    const contact = await this.contactRepo.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });
    return contact?.user?.name || 'A friend';
  }
}
