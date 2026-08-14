import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TripPing, SosEvent, Incident, DeviationEvent } from '../../database/entities/safety.entities';
import { Booking } from '../../database/entities/booking.entities';
import { Trip } from '../../database/entities/trip.entities';
import { User } from '../../database/entities/user.entity';
import { EmergencyContact } from '../../database/entities/communication.entities';
import { SosTriggerType, SosStatus, DeviationStatus, BookingStatus, UserRole } from '../../common/enums';
import { PinoLogger } from 'nestjs-pino';
import axios from 'axios';
import { RealtimeGateway } from '../../common/gateways/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Kept short: an SOS must not stall behind a slow third party. If Noonlight
 * hasn't answered in this window we escalate locally and move on.
 */
const NOONLIGHT_TIMEOUT_MS = 5_000;

@Injectable()
export class SafetyService {
  private mapboxAccessToken: string;
  private appUrl: string;
  private noonlightApiUrl: string;
  private noonlightApiKey: string;

  constructor(
    @InjectRepository(TripPing)
    private readonly pingRepo: Repository<TripPing>,
    @InjectRepository(SosEvent)
    private readonly sosRepo: Repository<SosEvent>,
    @InjectRepository(Incident)
    private readonly incidentRepo: Repository<Incident>,
    @InjectRepository(DeviationEvent)
    private readonly deviationRepo: Repository<DeviationEvent>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmergencyContact)
    private readonly emergencyContactRepo: Repository<EmergencyContact>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {
    this.mapboxAccessToken = this.config.get<string>('MAPBOX_ACCESS_TOKEN') || '';
    this.appUrl = this.config.get<string>('APP_URL') || 'https://bovogo.app';
    this.noonlightApiUrl =
      this.config.get<string>('NOONLIGHT_API_URL') || 'https://api-sandbox.noonlight.com';
    this.noonlightApiKey = this.config.get<string>('NOONLIGHT_API_KEY') || '';
  }

  /**
   * Creates a Noonlight alarm so a real dispatcher is engaged alongside our own
   * escalation. Never throws: the local SOS flow (emergency contacts, ops
   * paging, 911 on-device) must complete even if Noonlight is unreachable.
   * Returns the alarm id, or null when unconfigured or the call fails.
   */
  private async createNoonlightAlarm(input: {
    person: { name: string; phone: string };
    location: Record<string, unknown>;
    instructions: string;
  }): Promise<string | null> {
    if (!this.noonlightApiKey) {
      this.logger.warn(
        'NOONLIGHT_API_KEY is not set — SOS will escalate locally only, with no professional dispatch.',
      );
      return null;
    }

    try {
      const res = await axios.post(
        `${this.noonlightApiUrl}/dispatch/v1/alarms`,
        {
          name: input.person.name,
          phone: input.person.phone,
          location: input.location,
          instructions: { entry: input.instructions },
        },
        {
          headers: {
            Authorization: `Bearer ${this.noonlightApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: NOONLIGHT_TIMEOUT_MS,
        },
      );

      const alarmId: string | null = res.data?.id ?? null;
      this.logger.info({ alarmId }, 'Noonlight alarm created');
      return alarmId;
    } catch (err) {
      this.logger.error(
        { err },
        'Noonlight dispatch failed — continuing with local SOS escalation',
      );
      return null;
    }
  }

  async receivePing(
    userId: string,
    bookingId: string,
    latitude: number,
    longitude: number,
    accuracy?: number,
    speed?: number,
    batteryLevel?: number,
  ): Promise<{ deviation_triggered: boolean }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });

    if (!booking) throw new BadRequestException('Booking not found');
    if (!['en_route', 'in_progress'].includes(booking.status)) {
      throw new BadRequestException('Trip not active');
    }

    const isDriver = booking.trip.driver_id === userId;
    if (!isDriver) {
      throw new BadRequestException('Only the driver can send location pings');
    }

    const ping = this.pingRepo.create({
      booking_id: bookingId,
      location: `POINT(${longitude} ${latitude})`,
      accuracy: accuracy || null,
      speed: speed || null,
      battery_level: batteryLevel || null,
      timestamp: new Date().toISOString(),
    });
    await this.pingRepo.save(ping);

    await this.bookingRepo.update(bookingId, {
      last_known_location: `POINT(${longitude} ${latitude})`,
      last_ping_at: new Date().toISOString(),
    });

    const deviationResult = await this.detectRouteDeviation(booking, latitude, longitude);

    const trip = booking.trip;
    let eta: number | null = null;
    let progress: number | null = null;
    if (trip.dest_lat && trip.dest_lng) {
      const distToDest = this.haversineDistance(latitude, longitude, trip.dest_lat, trip.dest_lng);
      eta = Math.round(distToDest / 30 * 60);
    }
    if (trip.origin_lat && trip.origin_lng && trip.dest_lat && trip.dest_lng) {
      const totalDist = this.haversineDistance(trip.origin_lat, trip.origin_lng, trip.dest_lat, trip.dest_lng);
      const distTraveled = this.haversineDistance(trip.origin_lat, trip.origin_lng, latitude, longitude);
      progress = totalDist > 0 ? Math.min(100, Math.round(distTraveled / totalDist * 100)) : 0;
    }

    this.realtime.emitTripPing(bookingId, {
      latitude,
      longitude,
      accuracy: accuracy || null,
      speed: speed || null,
      eta_minutes: eta,
      progress,
      timestamp: new Date().toISOString(),
    });

    return { deviation_triggered: deviationResult };
  }

  private async detectRouteDeviation(
    booking: Booking,
    lat: number,
    lng: number,
  ): Promise<boolean> {
    const trip = booking.trip;
    if (!trip.mapbox_route_polyline) {
      this.logger.info({ bookingId: booking.id }, 'No route polyline stored, skipping deviation check');
      return false;
    }

    try {
      const snappedPoint = await this.snapToRoad(lat, lng);
      if (!snappedPoint) {
        this.logger.warn({ lat, lng }, 'Could not snap point to road');
        return false;
      }

      const distanceFromRoute = this.haversineDistance(
        snappedPoint.latitude,
        snappedPoint.longitude,
        lat,
        lng,
      );

      if (distanceFromRoute > 5) {
        this.logger.warn(
          { bookingId: booking.id, deviationMiles: distanceFromRoute },
          'Route deviation detected (>5 miles)',
        );

        await this.createDeviationEvent(booking, lat, lng, distanceFromRoute);
        return true;
      }

      return false;
    } catch (err) {
      this.logger.warn({ err, bookingId: booking.id }, 'Deviation detection failed');
      return false;
    }
  }

  private async snapToRoad(lat: number, lng: number): Promise<{ latitude: number; longitude: number } | null> {
    if (!this.mapboxAccessToken) return null;

    try {
      const url = `https://api.mapbox.com/matching/v5/mapbox/driving/${lng},${lat}?access_token=${this.mapboxAccessToken}&radiuses=50&geometries=geojson&overview=false`;
      const { data } = await axios.get(url);

      if (data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates[0];
        return { longitude: coords[0], latitude: coords[1] };
      }
      return null;
    } catch (err) {
      this.logger.warn({ err }, 'Mapbox Map Matching failed');
      return null;
    }
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private async createDeviationEvent(
    booking: Booking,
    lat: number,
    lng: number,
    distanceMiles: number,
  ): Promise<void> {
    const deviation = this.deviationRepo.create({
      booking_id: booking.id,
      actual_location: `POINT(${lng} ${lat})`,
      deviation_distance_miles: distanceMiles,
      status: DeviationStatus.PENDING,
    });
    await this.deviationRepo.save(deviation);

    const trip = booking.trip;
    const driverName = trip.driver?.name || 'Driver';
    const riderId = booking.rider_id;
    const driverId = trip.driver_id;

    await this.notifications.send(
      riderId,
      'safety',
      'Route Deviation Detected',
      `Your trip with ${driverName} has deviated from the expected route. Are you ok?`,
      { booking_id: booking.id, deviation_id: deviation.id, screen: `booking/${booking.id}` },
    );

    await this.notifications.send(
      driverId,
      'safety',
      'Route Deviation Detected',
      `You appear to be off the planned route. Tap to confirm you're okay.`,
      { booking_id: booking.id, deviation_id: deviation.id },
    );

    setTimeout(async () => {
      const fresh = await this.deviationRepo.findOne({ where: { id: deviation.id } });
      if (fresh && fresh.status === DeviationStatus.PENDING) {
        await this.escalateDeviation(deviation.id, booking);
      }
    }, 5 * 60 * 1000);
  }

  private async escalateDeviation(deviationId: string, booking: Booking): Promise<void> {
    const deviation = await this.deviationRepo.findOne({ where: { id: deviationId } });
    if (!deviation || deviation.status !== DeviationStatus.PENDING) return;

    deviation.status = DeviationStatus.ESCALATED;
    deviation.ts_paged_at = new Date().toISOString();
    await this.deviationRepo.save(deviation);

    await this.pageTeamAndEscalate(booking);

    this.logger.warn(
      { deviationId, bookingId: booking.id },
      'Deviation escalated to T&S team',
    );
  }

  private async pageTeamAndEscalate(booking: Booking, description?: string): Promise<void> {
    const tsAgents = await this.userRepo.find({
      where: { role: UserRole.TS_AGENT },
    });

    for (const agent of tsAgents) {
      await this.notifications.sendPush(
        agent.id,
        'URGENT: Safety Alert',
        description || `Booking ${booking.id} — emergency escalation required`,
        { booking_id: booking.id, screen: `booking/${booking.id}` },
      );
    }
  }

  async respondToDeviation(deviationId: string, response: string): Promise<void> {
    const deviation = await this.deviationRepo.findOne({ where: { id: deviationId } });
    if (!deviation) throw new BadRequestException('Deviation event not found');

    deviation.response = response;
    deviation.responded_at = new Date().toISOString();
    deviation.status = response === 'ok' ? DeviationStatus.RESPONDED_OK : DeviationStatus.FALSE_ALARM;
    await this.deviationRepo.save(deviation);
  }

  async activateSOS(
    userId: string,
    triggerType: SosTriggerType,
    bookingId: string | undefined,
    lat: number,
    lng: number,
  ): Promise<{ sos_id: string; noonlight_alarm_id: string | null }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    let booking: Booking | null = null;
    let tripContext = '';

    if (bookingId) {
      booking = await this.bookingRepo.findOne({
        where: { id: bookingId },
        relations: ['trip', 'trip.driver', 'rider'],
      });
      if (booking) {
        const trip = booking.trip;
        tripContext = `Trip: ${trip?.origin_metro} → ${trip?.dest_metro}. Driver: ${trip?.driver?.name}. Rider: ${booking.rider?.name}`;
      }
    }

    const location = {
      latitude: lat,
      longitude: lng,
      address: {
        line1: 'GPS Location',
        city: '',
        state: '',
        zip: '',
        country: 'US',
      },
    };

    const person = {
      name: user.name,
      phone: user.phone || '',
    };

    // Dispatch to Noonlight first so professional responders are engaged as
    // early as possible; the call is non-throwing and returns null on failure.
    const noonlightAlarmId = await this.createNoonlightAlarm({
      person,
      location,
      instructions: `Bovogo SOS activated via ${triggerType}. ${tripContext}`.trim(),
    });

    const sosEvent = this.sosRepo.create({
      user_id: userId,
      booking_id: bookingId || null,
      trigger_type: triggerType,
      status: SosStatus.ACTIVE,
      latitude: lat,
      longitude: lng,
      noonlight_alarm_id: noonlightAlarmId,
    });
    const savedSos = await this.sosRepo.save(sosEvent);

    const incident = this.incidentRepo.create({
      user_id: userId,
      booking_id: bookingId || null,
      severity: 'P0',
      description: `SOS activated via ${triggerType}. ${tripContext}`,
      status: 'open',
    });
    await this.incidentRepo.save(incident);

    // Always notify emergency contacts. Previously this was gated on a booking
    // existing, so an SOS raised outside a trip silently told nobody.
    await this.notifyEmergencyContacts(user, lat, lng);

    await this.pageTeamAndEscalate(
      booking!,
      `SOS activated by ${user.name} via ${triggerType}. Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    );

    return {
      sos_id: savedSos.id,
      noonlight_alarm_id: noonlightAlarmId,
    };
  }

  private async notifyEmergencyContacts(
    user: User,
    lat: number,
    lng: number,
  ): Promise<void> {
    const contacts = await this.emergencyContactRepo.find({
      where: { user_id: user.id, opted_in: true },
    });

    const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
    const message =
      `SAFETY ALERT: ${user.name} has activated an emergency alert on Bovogo. ` +
      `Their last known location: ${mapsLink}. ` +
      `If you don't hear from them soon, please check in.`;

    for (const contact of contacts) {
      try {
        await this.notifications.sendSMS(contact.phone, message);
        this.logger.info(
          { contactId: contact.id, contactName: contact.name },
          'Emergency contact notified via SMS',
        );
      } catch (err) {
        this.logger.warn(
          { err, contactId: contact.id },
          'Failed to notify emergency contact',
        );
      }
    }
  }

  async cancelSOS(
    userId: string,
    sosId: string,
    safeWord: string,
  ): Promise<{ status: string }> {
    const sosEvent = await this.sosRepo.findOne({
      where: { id: sosId, user_id: userId },
    });
    if (!sosEvent) throw new BadRequestException('SOS event not found');

    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (user?.safe_word && safeWord.toLowerCase() === user.safe_word.toLowerCase()) {
      sosEvent.status = SosStatus.FALSE_ALARM;
      await this.sosRepo.save(sosEvent);

      const contacts = await this.emergencyContactRepo.find({
        where: { user_id: userId, opted_in: true },
      });

      const allClearMsg =
        `ALL CLEAR: ${user?.name}'s earlier safety alert has been resolved. ` +
        `They have confirmed they are safe. No further action needed.`;

      for (const contact of contacts) {
        try {
          await this.notifications.sendSMS(contact.phone, allClearMsg);
        } catch (err) {
          this.logger.warn({ err }, 'Failed to send all-clear SMS');
        }
      }

      return { status: 'cancelled_all_clear' };
    }

    return { status: 'safe_word_mismatch' };
  }

  async handleNoonlightWebhook(payload: { alarm_id: string; status: string; dispatch_status?: string }): Promise<void> {
    const sosEvent = await this.sosRepo.findOne({
      where: { noonlight_alarm_id: payload.alarm_id },
    });
    if (!sosEvent) {
      this.logger.warn({ alarmId: payload.alarm_id }, 'Noonlight webhook for unknown alarm');
      return;
    }

    if (payload.status === 'dispatched') {
      sosEvent.status = SosStatus.DISPATCHED;
    } else if (payload.status === 'cancelled') {
      sosEvent.status = SosStatus.FALSE_ALARM;
    }

    if (sosEvent.status !== undefined) {
      await this.sosRepo.save(sosEvent);
      this.logger.info({ sosId: sosEvent.id, newStatus: sosEvent.status }, 'SOS status updated via Noonlight webhook');
    }
  }

  async submitUnsafeFeeling(
    userId: string,
    bookingId: string,
    lat: number,
    lng: number,
    description?: string,
  ): Promise<{ incident_id: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new BadRequestException('Booking not found');

    const sosEvent = this.sosRepo.create({
      user_id: userId,
      booking_id: bookingId,
      trigger_type: SosTriggerType.UNSAFE_FEELING,
      status: SosStatus.RESOLVED,
      latitude: lat,
      longitude: lng,
      noonlight_alarm_id: null,
    });
    await this.sosRepo.save(sosEvent);

    const incident = this.incidentRepo.create({
      user_id: userId,
      booking_id: bookingId,
      severity: 'P0',
      description: `User reported feeling unsafe. ${description || ''} Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      status: 'open',
    });
    const savedIncident = await this.incidentRepo.save(incident);

    await this.pageTeamAndEscalate(
      booking,
      `"I feel unsafe" report from ${user.name} on booking ${bookingId}. ${description || ''}`,
    );

    this.logger.info(
      { userId, bookingId, incidentId: savedIncident.id },
      'Unsafe feeling report submitted — T&S notified (no 911)',
    );

    return { incident_id: savedIncident.id };
  }

  async getTrackToken(bookingId: string): Promise<{ share_token: string; url: string }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new BadRequestException('Booking not found');
    if (!['en_route', 'in_progress', 'completed'].includes(booking.status)) {
      throw new BadRequestException('Tracking not available until ride has started');
    }

    if (!booking.share_token) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let token = '';
      for (let i = 0; i < 16; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
      }
      booking.share_token = token;
      await this.bookingRepo.save(booking);
    }

    return {
      share_token: booking.share_token,
      url: `${this.appUrl}/track/${booking.share_token}`,
    };
  }

  async getPublicTrack(token: string): Promise<any> {
    const booking = await this.bookingRepo.findOne({
      where: { share_token: token },
      relations: ['trip', 'trip.driver', 'trip.vehicle'],
    });
    if (!booking) throw new BadRequestException('Invalid tracking token');

    const trip = booking.trip;
    if (booking.status === 'completed') {
      const oneHourAfter = new Date(booking.updated_at).getTime() + 3600000;
      if (Date.now() > oneHourAfter) {
        throw new BadRequestException('Tracking link expired');
      }
    } else if (!['en_route', 'in_progress'].includes(booking.status)) {
      throw new BadRequestException('Tracking not available until ride has started');
    }

    const latestPing = await this.pingRepo.findOne({
      where: { booking_id: booking.id },
      order: { timestamp: 'DESC' },
    });

    let currentLat: number | null = null;
    let currentLng: number | null = null;
    if (latestPing?.location) {
      const match = latestPing.location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
      if (match) {
        currentLng = parseFloat(match[1]);
        currentLat = parseFloat(match[2]);
      }
    }

    let eta: number | null = null;
    if (currentLat && currentLng && trip.dest_lat && trip.dest_lng) {
      eta = Math.round(
        this.haversineDistance(currentLat, currentLng, trip.dest_lat, trip.dest_lng) /
          30 * 60,
      );
    }

    return {
      booking_id: booking.id,
      driver_name: trip.driver?.display_name || trip.driver?.name || 'Driver',
      vehicle_make: trip.vehicle?.make || '',
      vehicle_model: trip.vehicle?.model || '',
      vehicle_year: trip.vehicle?.year || null,
      vehicle_color: trip.vehicle?.color || '',
      license_plate: trip.vehicle?.license_plate || '',
      current_lat: currentLat,
      current_lng: currentLng,
      accuracy: latestPing?.accuracy || null,
      route_polyline: trip.mapbox_route_polyline || null,
      eta_minutes: eta,
      origin_metro: trip.origin_metro,
      dest_metro: trip.dest_metro,
      last_updated: latestPing?.timestamp || null,
      status: booking.status,
      safety_badge: true,
    };
  }

  async getTrackingHistory(bookingId: string): Promise<TripPing[]> {
    return this.pingRepo.find({
      where: { booking_id: bookingId },
      order: { timestamp: 'ASC' },
    });
  }

  async getDeviationHistory(bookingId: string): Promise<DeviationEvent[]> {
    return this.deviationRepo.find({
      where: { booking_id: bookingId },
      order: { created_at: 'DESC' },
    });
  }

  async getMySOSHistory(userId: string): Promise<SosEvent[]> {
    return this.sosRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async checkTripOverruns(): Promise<void> {
    const activeBookings = await this.bookingRepo.find({
      where: { status: BookingStatus.EN_ROUTE },
      relations: ['trip'],
    });

    for (const booking of activeBookings) {
      const trip = booking.trip;
      if (!trip.expected_arrival_time) continue;

      const expectedArrival = new Date(trip.expected_arrival_time).getTime();
      const now = Date.now();
      const minutesOver = (now - expectedArrival) / 60000;

      if (minutesOver > 60) {
        const existing = await this.deviationRepo.findOne({
          where: {
            booking_id: booking.id,
            status: 'pending',
          },
        });

        if (!existing) {
          this.logger.warn(
            { bookingId: booking.id, minutesOver },
            'Trip overrun detected (>60 min past ETA)',
          );

          const deviation = this.deviationRepo.create({
            booking_id: booking.id,
            deviation_distance_miles: 0,
            time_off_route_seconds: Math.round(minutesOver * 60),
            status: DeviationStatus.PENDING,
          });
          await this.deviationRepo.save(deviation);

          await this.notifications.send(
            booking.rider_id,
            'safety',
            'Trip Running Late',
            `Your trip is running more than 60 minutes past the expected arrival time. Please check in.`,
            { booking_id: booking.id, deviation_id: deviation.id },
          );

          setTimeout(async () => {
            const fresh = await this.deviationRepo.findOne({ where: { id: deviation.id } });
            if (fresh && fresh.status === DeviationStatus.PENDING) {
              await this.escalateDeviation(deviation.id, booking);
            }
          }, 5 * 60 * 1000);
        }
      }
    }
  }

  async storeRouteForTrip(
    tripId: string,
    polyline: string,
    expectedArrival: Date,
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<void> {
    await this.tripRepo.update(tripId, {
      mapbox_route_polyline: polyline,
      expected_arrival_time: expectedArrival.toISOString(),
      origin_lat: originLat,
      origin_lng: originLng,
      dest_lat: destLat,
      dest_lng: destLng,
    });
  }
}
