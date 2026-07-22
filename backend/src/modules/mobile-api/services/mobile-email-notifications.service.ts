import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../../notifications/notifications.service';
import { MobileTrip, MobileUser } from '../entities/mobile.entities';

const TEMPLATE = 'founding_insurance_placeholder';

function cityShort(city: string): string {
  return city.replace(/, TX$/i, '').replace(/, AR$/i, '').trim();
}

function formatDeparture(departureAt: Date): { date: string; time: string } {
  const date = departureAt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  });
  const time = departureAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  });
  return { date, time };
}

function formatPrice(amount: string | number): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return String(amount);
  return `$${n.toFixed(2)}`;
}

/**
 * Sends templated emails for mobile users via Resend. Uses direct sendEmail
 * because mobile_users are isolated from the main users table used by the
 * notification queue's user lookup.
 */
@Injectable()
export class MobileEmailNotificationsService {
  private readonly logger = new Logger(MobileEmailNotificationsService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async sendBookingConfirmedEmail(params: {
    rider: MobileUser;
    trip: MobileTrip;
    driverName: string;
    bookingId: string;
    totalAmount: string;
  }): Promise<void> {
    const { rider, trip, driverName, bookingId, totalAmount } = params;
    if (!rider.email) return;

    const { date, time } = formatDeparture(trip.departure_at);
    const isFounding = Boolean(rider.is_founding_member);
    const subject = isFounding
      ? 'Your adventure is booked — fully insured as a founding member'
      : 'Your Bovogo adventure is booked';

    await this.sendSafe(rider.email, {
      userName: rider.name.split(' ')[0] || rider.name,
      role: 'rider',
      originMetro: cityShort(trip.from_city),
      destMetro: cityShort(trip.to_city),
      departureDate: date,
      departureTime: time,
      isFoundingMember: isFounding,
      driverName,
      totalPrice: formatPrice(totalAmount),
      tripLink: this.tripLink(trip.id, bookingId),
      subject,
    });
  }

  async sendPreTripVideoReceivedEmail(params: {
    driver: MobileUser;
    trip: MobileTrip;
  }): Promise<void> {
    const { driver, trip } = params;
    if (!driver.email) return;

    const { date, time } = formatDeparture(trip.departure_at);
    const isFounding = Boolean(driver.is_founding_member);
    const subject = isFounding
      ? 'Pre-trip video received — your adventure is fully insured'
      : 'Pre-trip video received — you can start your adventure';

    await this.sendSafe(driver.email, {
      userName: driver.name.split(' ')[0] || driver.name,
      role: 'driver',
      originMetro: cityShort(trip.from_city),
      destMetro: cityShort(trip.to_city),
      departureDate: date,
      departureTime: time,
      isFoundingMember: isFounding,
      tripLink: this.tripLink(trip.id),
      subject,
    });
  }

  private tripLink(tripId: string, bookingId?: string): string {
    const base =
      this.config.get<string>('MOBILE_APP_URL') ||
      this.config.get<string>('APP_URL') ||
      'https://bovogo.app';
    const path = bookingId
      ? `/booking-confirmed?id=${bookingId}`
      : `/tracking/${tripId}`;
    return `${base.replace(/\/$/, '')}${path}`;
  }

  private async sendSafe(
    to: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey || apiKey.includes('your-resend')) {
      this.logger.warn(
        { to, template: TEMPLATE },
        'RESEND_API_KEY not configured — skipping mobile email',
      );
      return;
    }

    try {
      await this.notifications.sendEmail(to, TEMPLATE, {
        userName: String(context.userName ?? 'Sailor'),
        ...context,
      });
    } catch (err) {
      this.logger.error(
        { err, to, template: TEMPLATE },
        'Failed to send mobile email',
      );
    }
  }
}
