import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SafetyService } from './safety.service';
import {
  TripPing,
  SosEvent,
  Incident,
  DeviationEvent,
} from '../../database/entities/safety.entities';
import { Booking } from '../../database/entities/booking.entities';
import { Trip } from '../../database/entities/trip.entities';
import { User } from '../../database/entities/user.entity';
import { EmergencyContact } from '../../database/entities/communication.entities';
import {
  SosTriggerType,
  SosStatus,
  DeviationStatus,
  BookingStatus,
  UserRole,
} from '../../common/enums';
import { PinoLogger } from 'nestjs-pino';
import { RealtimeGateway } from '../../common/gateways/realtime.gateway';
import { MobileSosEvent } from '../mobile-api/entities/mobile.entities';
import { NoonlightService } from '../noonlight/noonlight.service';
import { RoutingService } from '../routing/routing.service';
import {
  decodePolyline,
  encodePolyline,
} from '../../common/geo/route-geometry';

/**
 * A real route through the coordinate the ping tests use (34.0522,-118.2437),
 * running roughly north-south through it. The fixture used to be the string
 * 'encoded_polyline_data', which decodes to nonsense — fine when the code never
 * read the polyline, misleading now that it does.
 */
const ROUTE_THROUGH_TEST_POINT = encodePolyline([
  { latitude: 34.2022, longitude: -118.2437 },
  { latitude: 34.0522, longitude: -118.2437 },
  { latitude: 33.9022, longitude: -118.2437 },
]);
import { NotificationsService } from '../notifications/notifications.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Two paths here arm a five-minute escalation `setTimeout` in production code —
 * `createDeviationEvent` and `checkTripOverruns`. Those describes install fake
 * timers and clear them afterwards; without that the timers outlive the last
 * assertion and Jest never exits. The escalation itself is asserted by advancing
 * the clock, so the cleanup does not cost coverage.
 */
describe('SafetyService', () => {
  let service: SafetyService;
  let module: TestingModule;
  let pingRepo: jest.Mocked<Repository<TripPing>>;
  let sosRepo: jest.Mocked<Repository<SosEvent>>;
  let incidentRepo: jest.Mocked<Repository<Incident>>;
  let deviationRepo: jest.Mocked<Repository<DeviationEvent>>;
  let bookingRepo: jest.Mocked<Repository<Booking>>;
  let tripRepo: jest.Mocked<Repository<Trip>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let emergencyContactRepo: jest.Mocked<Repository<EmergencyContact>>;
  let mobileSosRepo: jest.Mocked<Repository<MobileSosEvent>>;
  let noonlight: { createAlarm: jest.Mock };
  let notificationsService: jest.Mocked<NotificationsService>;
  let logger: jest.Mocked<PinoLogger>;

  const mockUser: User = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    phone: '+15551234567',
    safe_word: 'sunflower',
    role: UserRole.USER,
  } as User;

  const mockDriver: User = {
    id: 'driver-1',
    name: 'John Driver',
    email: 'driver@example.com',
    phone: '+15559876543',
    display_name: 'John D.',
    role: UserRole.DRIVER,
  } as User;

  const mockRider: User = {
    id: 'rider-1',
    name: 'Jane Rider',
    email: 'rider@example.com',
    phone: '+15551112222',
    role: UserRole.USER,
  } as User;

  const mockTrip: Trip = {
    id: 'trip-1',
    driver_id: 'driver-1',
    driver: mockDriver,
    origin_metro: 'Downtown',
    dest_metro: 'Airport',
    origin_lat: 34.0522,
    origin_lng: -118.2437,
    dest_lat: 33.9425,
    dest_lng: -118.4081,
    mapbox_route_polyline: ROUTE_THROUGH_TEST_POINT,
    expected_arrival_time: new Date(Date.now() + 3600000).toISOString(),
    vehicle: {
      id: 'vehicle-1',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      color: 'Silver',
      license_plate: 'ABC123',
    },
  } as Trip;

  const mockBooking: Booking = {
    id: 'booking-1',
    rider_id: 'rider-1',
    rider: mockRider,
    trip: mockTrip,
    status: BookingStatus.EN_ROUTE,
    seats: 2,
    share_token: null,
    last_known_location: null,
    last_ping_at: null,
    updated_at: new Date().toISOString(),
  } as Booking;

  const mockActiveBookingWithRelations: Booking = {
    ...mockBooking,
    trip: { ...mockTrip, driver: mockDriver },
    rider: mockRider,
  };

  beforeEach(async () => {
    const mockRepo = () => ({
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data: any) => data),
      save: jest.fn(async (data: any) => ({ ...data, id: 'generated-id' })),
      update: jest.fn(),
      delete: jest.fn(),
    });

    module = await Test.createTestingModule({
      providers: [
        SafetyService,
        {
          provide: getRepositoryToken(TripPing),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(SosEvent),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(Incident),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(DeviationEvent),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(Booking),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(Trip),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(User),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(EmergencyContact),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(MobileSosEvent),
          useFactory: mockRepo,
        },
        {
          // The real one is exercised through the live sandbox, not here; these
          // tests are about what SafetyService does with the id it gets back.
          provide: NoonlightService,
          useValue: {
            createAlarm: jest.fn().mockResolvedValue('noonlight-alarm-123'),
          },
        },
        {
          // Decodes for real — the geometry has its own suite — so only the
          // network fetch is stubbed.
          provide: RoutingService,
          useValue: {
            decode: (enc: string) => decodePolyline(enc, 5),
            routeBetweenCities: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                MAPBOX_ACCESS_TOKEN: 'pk.test_mapbox_token',
                NOONLIGHT_API_URL: 'https://api-sandbox.noonlight.com',
                NOONLIGHT_API_KEY: 'test_noonlight_key',
                APP_URL: 'https://wegotcha.app',
              };
              return config[key];
            }),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            send: jest.fn(),
            sendPush: jest.fn(),
            sendSMS: jest.fn(),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: RealtimeGateway,
          useValue: {
            emitTripPing: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SafetyService>(SafetyService);
    pingRepo = module.get(getRepositoryToken(TripPing));
    sosRepo = module.get(getRepositoryToken(SosEvent));
    incidentRepo = module.get(getRepositoryToken(Incident));
    deviationRepo = module.get(getRepositoryToken(DeviationEvent));
    bookingRepo = module.get(getRepositoryToken(Booking));
    tripRepo = module.get(getRepositoryToken(Trip));
    userRepo = module.get(getRepositoryToken(User));
    emergencyContactRepo = module.get(getRepositoryToken(EmergencyContact));
    mobileSosRepo = module.get(getRepositoryToken(MobileSosEvent));
    noonlight = module.get(NoonlightService);
    notificationsService = module.get(NotificationsService);
    logger = module.get(PinoLogger);

    jest.clearAllMocks();
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
  });

  afterEach(async () => {
    await module.close();
  });

  /**
   * Fake timers for a describe whose subject arms the escalation timeout.
   * `clearAllTimers` is what actually lets the worker exit — closing the
   * TestingModule cannot reach a raw `setTimeout` the service holds no handle to.
   */
  function withFakeTimers() {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });
  }

  describe('receivePing', () => {
    withFakeTimers();

    it('should store location ping and return deviation_triggered false when within route', async () => {
      bookingRepo.findOne.mockResolvedValue(mockActiveBookingWithRelations);
      pingRepo.save.mockResolvedValue({} as TripPing);
      bookingRepo.update.mockResolvedValue({} as any);
      mockedAxios.get.mockResolvedValue({
        data: {
          features: [{ geometry: { coordinates: [[-118.2437, 34.0522]] } }],
        },
      });

      const result = await service.receivePing(
        'driver-1',
        'booking-1',
        34.0522,
        -118.2437,
        10,
        30,
        80,
      );

      expect(pingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_id: 'booking-1',
          location: 'POINT(-118.2437 34.0522)',
          accuracy: 10,
          speed: 30,
          battery_level: 80,
        }),
      );
      expect(pingRepo.save).toHaveBeenCalled();
      expect(bookingRepo.update).toHaveBeenCalledWith(
        'booking-1',
        expect.any(Object),
      );
      expect(result.deviation_triggered).toBe(false);
    });

    it('should throw if booking not found', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.receivePing('driver-1', 'nonexistent', 34.0522, -118.2437),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if trip is not active', async () => {
      bookingRepo.findOne.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.COMPLETED,
      });

      await expect(
        service.receivePing('driver-1', 'booking-1', 34.0522, -118.2437),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if non-driver sends ping', async () => {
      bookingRepo.findOne.mockResolvedValue(mockActiveBookingWithRelations);

      await expect(
        service.receivePing('random-user', 'booking-1', 34.0522, -118.2437),
      ).rejects.toThrow(BadRequestException);
    });

    it('should trigger deviation when distance from route > 5 miles', async () => {
      bookingRepo.findOne.mockResolvedValue(mockActiveBookingWithRelations);
      pingRepo.save.mockResolvedValue({} as TripPing);
      bookingRepo.update.mockResolvedValue({} as any);
      mockedAxios.get.mockResolvedValue({
        data: {
          features: [{ geometry: { coordinates: [[-118.2437, 34.0522]] } }],
        },
      });
      deviationRepo.create.mockReturnValue({ id: 'dev-1' } as DeviationEvent);
      deviationRepo.save.mockResolvedValue({ id: 'dev-1' } as DeviationEvent);

      const result = await service.receivePing(
        'driver-1',
        'booking-1',
        34.15,
        -118.35,
      );

      expect(deviationRepo.create).toHaveBeenCalled();
      expect(deviationRepo.save).toHaveBeenCalled();
      expect(result.deviation_triggered).toBe(true);
    });

    it('should escalate a deviation nobody answered after five minutes', async () => {
      const saveSpy = jest.spyOn(deviationRepo, 'save');
      const pushSpy = jest.spyOn(notificationsService, 'sendPush');
      bookingRepo.findOne.mockResolvedValue(mockActiveBookingWithRelations);
      pingRepo.save.mockResolvedValue({} as TripPing);
      bookingRepo.update.mockResolvedValue({
        raw: [],
        affected: 1,
        generatedMaps: [],
      });
      mockedAxios.get.mockResolvedValue({
        data: {
          features: [{ geometry: { coordinates: [[-118.2437, 34.0522]] } }],
        },
      });
      deviationRepo.create.mockReturnValue({ id: 'dev-1' } as DeviationEvent);
      deviationRepo.save.mockResolvedValue({ id: 'dev-1' } as DeviationEvent);
      // Still unanswered when the timeout checks back.
      deviationRepo.findOne.mockResolvedValue({
        id: 'dev-1',
        status: DeviationStatus.PENDING,
      } as DeviationEvent);
      userRepo.find.mockResolvedValue([{ id: 'ts-1' } as User]);

      await service.receivePing('driver-1', 'booking-1', 34.15, -118.35);
      deviationRepo.save.mockClear();

      await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: DeviationStatus.ESCALATED }),
      );
      expect(pushSpy).toHaveBeenCalledWith(
        'ts-1',
        'URGENT: Safety Alert',
        expect.stringContaining('booking-1'),
        expect.objectContaining({ booking_id: 'booking-1' }),
      );
    });
  });

  describe('activateSOS', () => {
    it('should create SOS event and incident, notify emergency contacts, and page TS agents', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      bookingRepo.findOne.mockResolvedValue(mockActiveBookingWithRelations);
      sosRepo.create.mockReturnValue({ id: 'sos-1' } as SosEvent);
      sosRepo.save.mockResolvedValue({ id: 'sos-1' } as SosEvent);
      incidentRepo.create.mockReturnValue({ id: 'inc-1' } as Incident);
      incidentRepo.save.mockResolvedValue({ id: 'inc-1' } as Incident);
      emergencyContactRepo.find.mockResolvedValue([
        {
          id: 'ec-1',
          phone: '+15559998888',
          name: 'Mom',
          opted_in: true,
        } as EmergencyContact,
      ]);
      userRepo.find.mockResolvedValue([]);

      const result = await service.activateSOS(
        'user-1',
        SosTriggerType.BUTTON,
        'booking-1',
        34.0522,
        -118.2437,
      );

      expect(sosRepo.save).toHaveBeenCalled();
      expect(incidentRepo.save).toHaveBeenCalled();
      expect(result.sos_id).toBe('sos-1');
      expect(result.noonlight_alarm_id).toBe('noonlight-alarm-123');
      expect(noonlight.createAlarm).toHaveBeenCalledWith(
        expect.objectContaining({ lat: 34.0522, lng: -118.2437 }),
      );
    });

    it('should continue with local flow if Noonlight API fails', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      bookingRepo.findOne.mockResolvedValue(mockActiveBookingWithRelations);
      sosRepo.create.mockReturnValue({ id: 'sos-2' } as SosEvent);
      sosRepo.save.mockResolvedValue({ id: 'sos-2' } as SosEvent);
      incidentRepo.create.mockReturnValue({ id: 'inc-2' } as Incident);
      incidentRepo.save.mockResolvedValue({ id: 'inc-2' } as Incident);
      // Dispatch returns null when Noonlight refuses or is unreachable; it
      // never throws, precisely so local escalation still runs.
      noonlight.createAlarm.mockResolvedValueOnce(null);
      emergencyContactRepo.find.mockResolvedValue([]);
      userRepo.find.mockResolvedValue([]);

      const result = await service.activateSOS(
        'user-1',
        SosTriggerType.VOLUME_SEQUENCE,
        'booking-1',
        34.0522,
        -118.2437,
      );

      expect(result.sos_id).toBe('sos-2');
      expect(result.noonlight_alarm_id).toBeNull();
    });

    it('should throw if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.activateSOS(
          'nonexistent',
          SosTriggerType.BUTTON,
          undefined,
          34.0522,
          -118.2437,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelSOS', () => {
    it('should cancel SOS and notify contacts when safe word matches', async () => {
      const mockSos = {
        id: 'sos-1',
        user_id: 'user-1',
        status: SosStatus.ACTIVE,
        noonlight_alarm_id: 'noonlight-alarm-123',
      } as SosEvent;

      sosRepo.findOne.mockResolvedValue(mockSos);
      userRepo.findOne.mockResolvedValue(mockUser);
      mockedAxios.post.mockResolvedValue({ data: {} });
      sosRepo.save.mockResolvedValue({
        ...mockSos,
        status: SosStatus.FALSE_ALARM,
      });
      emergencyContactRepo.find.mockResolvedValue([
        {
          id: 'ec-1',
          phone: '+15559998888',
          name: 'Mom',
          opted_in: true,
        } as EmergencyContact,
      ]);

      const result = await service.cancelSOS('user-1', 'sos-1', 'sunflower');

      expect(result.status).toBe('cancelled_all_clear');
      expect(sosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SosStatus.FALSE_ALARM }),
      );
      expect(notificationsService.sendSMS).toHaveBeenCalled();
    });

    it('should return safe_word_mismatch when word does not match', async () => {
      const mockSos = {
        id: 'sos-1',
        user_id: 'user-1',
        status: SosStatus.ACTIVE,
        noonlight_alarm_id: null,
      } as SosEvent;

      sosRepo.findOne.mockResolvedValue(mockSos);
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.cancelSOS('user-1', 'sos-1', 'wrongword');

      expect(result.status).toBe('safe_word_mismatch');
      expect(sosRepo.save).not.toHaveBeenCalled();
    });

    it('should throw if SOS event not found', async () => {
      sosRepo.findOne.mockResolvedValue(null);

      await expect(
        service.cancelSOS('user-1', 'nonexistent', 'sunflower'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle case-insensitive safe word matching', async () => {
      const mockSos = {
        id: 'sos-1',
        user_id: 'user-1',
        status: SosStatus.ACTIVE,
        noonlight_alarm_id: null,
      } as SosEvent;

      sosRepo.findOne.mockResolvedValue(mockSos);
      userRepo.findOne.mockResolvedValue(mockUser);
      sosRepo.save.mockResolvedValue({
        ...mockSos,
        status: SosStatus.FALSE_ALARM,
      });
      emergencyContactRepo.find.mockResolvedValue([]);

      const result = await service.cancelSOS('user-1', 'sos-1', 'SUNFLOWER');

      expect(result.status).toBe('cancelled_all_clear');
    });
  });

  describe('submitUnsafeFeeling', () => {
    it('should create SOS event with UNSAFE_FEELING trigger and P0 incident', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      bookingRepo.findOne.mockResolvedValue(mockActiveBookingWithRelations);
      sosRepo.create.mockReturnValue({
        id: 'sos-3',
        trigger_type: SosTriggerType.UNSAFE_FEELING,
        status: SosStatus.RESOLVED,
        noonlight_alarm_id: null,
      } as SosEvent);
      sosRepo.save.mockResolvedValue({ id: 'sos-3' } as SosEvent);
      incidentRepo.create.mockReturnValue({
        id: 'inc-3',
        severity: 'P0',
        status: 'open',
      } as Incident);
      incidentRepo.save.mockResolvedValue({
        id: 'inc-3',
        severity: 'P0',
        status: 'open',
      } as Incident);
      userRepo.find.mockResolvedValue([]);

      const result = await service.submitUnsafeFeeling(
        'user-1',
        'booking-1',
        34.0522,
        -118.2437,
        'Driver was speeding',
      );

      expect(sosRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_type: SosTriggerType.UNSAFE_FEELING,
          status: SosStatus.RESOLVED,
          noonlight_alarm_id: null,
        }),
      );
      expect(incidentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'P0',
          status: 'open',
        }),
      );
      expect(result.incident_id).toBe('inc-3');
    });

    it('should throw if booking not found', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.submitUnsafeFeeling(
          'user-1',
          'nonexistent',
          34.0522,
          -118.2437,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleNoonlightEvent', () => {
    // Payload shape captured from a real sandbox callback:
    // [{ event_id, event_time, event_type: 'alarm.closed', meta: { alarm_id } }]
    const sosFor = (status: SosStatus) =>
      ({
        id: 'sos-1',
        user_id: 'user-1',
        status,
        noonlight_alarm_id: 'noonlight-alarm-123',
      }) as SosEvent;

    // Noonlight documents exactly three verbs. alarm.dispatched and
    // alarm.canceled — which this code used to map — are not among them.
    it('moves an alarm to DISPATCHED on alarm.psap_contacted', async () => {
      sosRepo.findOne.mockResolvedValue(sosFor(SosStatus.ACTIVE));
      sosRepo.save.mockResolvedValue({} as SosEvent);

      const res = await service.handleNoonlightEvent({
        event_type: 'alarm.psap_contacted',
        meta: { alarm_id: 'noonlight-alarm-123' },
      });

      expect(res).toEqual({ applied: true });
      expect(sosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SosStatus.DISPATCHED }),
      );
    });

    it('marks a user cancellation as FALSE_ALARM on alarm.status.canceled', async () => {
      sosRepo.findOne.mockResolvedValue(sosFor(SosStatus.ACTIVE));
      sosRepo.save.mockResolvedValue({} as SosEvent);

      const res = await service.handleNoonlightEvent({
        event_type: 'alarm.status.canceled',
        meta: { alarm_id: 'noonlight-alarm-123' },
      });

      expect(res).toEqual({ applied: true });
      expect(sosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SosStatus.FALSE_ALARM }),
      );
    });

    it('still honours the legacy alarm.dispatched alias', async () => {
      sosRepo.findOne.mockResolvedValue(sosFor(SosStatus.ACTIVE));
      sosRepo.save.mockResolvedValue({} as SosEvent);

      const res = await service.handleNoonlightEvent({
        event_type: 'alarm.dispatched',
        meta: { alarm_id: 'noonlight-alarm-123' },
      });

      expect(res).toEqual({ applied: true });
      expect(sosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SosStatus.DISPATCHED }),
      );
    });

    // alarm.psap_contacted is documented to fire more than once, and webhooks
    // can arrive out of order — a late one must not reopen a closed emergency.
    it('does not reopen a resolved SOS when a PSAP event arrives late', async () => {
      sosRepo.findOne.mockResolvedValue(sosFor(SosStatus.RESOLVED));

      const res = await service.handleNoonlightEvent({
        event_type: 'alarm.psap_contacted',
        meta: { alarm_id: 'noonlight-alarm-123' },
      });

      expect(res).toEqual({ applied: false, reason: 'already_terminal' });
      expect(sosRepo.save).not.toHaveBeenCalled();
    });

    it('does not reopen a false-alarm SOS when a PSAP event arrives late', async () => {
      sosRepo.findOne.mockResolvedValue(sosFor(SosStatus.FALSE_ALARM));

      const res = await service.handleNoonlightEvent({
        event_type: 'alarm.psap_contacted',
        meta: { alarm_id: 'noonlight-alarm-123' },
      });

      expect(res).toEqual({ applied: false, reason: 'already_terminal' });
      expect(sosRepo.save).not.toHaveBeenCalled();
    });

    it('resolves the SOS on alarm.closed', async () => {
      sosRepo.findOne.mockResolvedValue(sosFor(SosStatus.ACTIVE));
      sosRepo.save.mockResolvedValue({} as SosEvent);

      const res = await service.handleNoonlightEvent({
        event_type: 'alarm.closed',
        meta: { alarm_id: 'noonlight-alarm-123' },
      });

      expect(res).toEqual({ applied: true });
      expect(sosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SosStatus.RESOLVED }),
      );
    });

    it('reads the alarm id from meta, not the top level', async () => {
      sosRepo.findOne.mockResolvedValue(null);

      await service.handleNoonlightEvent({
        event_type: 'alarm.closed',
        meta: { alarm_id: 'noonlight-alarm-123' },
      });

      expect(sosRepo.findOne).toHaveBeenCalledWith({
        where: { noonlight_alarm_id: 'noonlight-alarm-123' },
      });
    });

    it('ignores events for unknown alarms', async () => {
      sosRepo.findOne.mockResolvedValue(null);

      const res = await service.handleNoonlightEvent({
        event_type: 'alarm.closed',
        meta: { alarm_id: 'unknown-alarm' },
      });

      expect(res).toEqual({ applied: false, reason: 'unknown_alarm' });
      expect(sosRepo.save).not.toHaveBeenCalled();
    });

    it('ignores an event with no meta.alarm_id', async () => {
      const res = await service.handleNoonlightEvent({
        event_type: 'alarm.closed',
      });

      expect(res).toEqual({ applied: false, reason: 'unknown_alarm' });
      expect(sosRepo.findOne).not.toHaveBeenCalled();
    });

    it('leaves the status alone for an unmapped event type', async () => {
      sosRepo.findOne.mockResolvedValue(sosFor(SosStatus.ACTIVE));

      const res = await service.handleNoonlightEvent({
        event_type: 'alarm.something.new',
        meta: { alarm_id: 'noonlight-alarm-123' },
      });

      expect(res).toEqual({ applied: false, reason: 'unmapped_event' });
      expect(sosRepo.save).not.toHaveBeenCalled();
    });

    it('does not re-save when the status already matches', async () => {
      sosRepo.findOne.mockResolvedValue(sosFor(SosStatus.RESOLVED));

      const res = await service.handleNoonlightEvent({
        event_type: 'alarm.closed',
        meta: { alarm_id: 'noonlight-alarm-123' },
      });

      expect(res).toEqual({ applied: false, reason: 'no_change' });
      expect(sosRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getTrackToken', () => {
    it('should generate and return a 16-character share token', async () => {
      bookingRepo.findOne.mockResolvedValue(mockBooking);
      bookingRepo.save.mockResolvedValue({
        ...mockBooking,
        share_token: 'XFB28FC6C85PHJJU',
      });

      const result = await service.getTrackToken('booking-1');

      expect(bookingRepo.save).toHaveBeenCalled();
      expect(result.share_token).toHaveLength(16);
      expect(result.share_token).toMatch(/^[A-Z0-9]{16}$/);
      expect(result.url).toContain(result.share_token);
    });

    it('should return existing token if already generated', async () => {
      const existingTokenBooking = {
        ...mockBooking,
        share_token: 'EXISTINGTOKEN12345',
      };
      bookingRepo.findOne.mockResolvedValue(existingTokenBooking);

      const result = await service.getTrackToken('booking-1');

      expect(bookingRepo.save).not.toHaveBeenCalled();
      expect(result.share_token).toBe('EXISTINGTOKEN12345');
    });

    it('should throw if booking not found', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(service.getTrackToken('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getPublicTrack', () => {
    it('should return tracking data with current location from latest ping', async () => {
      const latestPing = {
        location: 'POINT(-118.2437 34.0522)',
        accuracy: 10,
        timestamp: new Date().toISOString(),
      } as TripPing;

      bookingRepo.findOne.mockResolvedValue({
        ...mockActiveBookingWithRelations,
        status: BookingStatus.EN_ROUTE,
      });
      pingRepo.findOne.mockResolvedValue(latestPing);

      const result = await service.getPublicTrack('test-token');

      expect(result.current_lat).toBe(34.0522);
      expect(result.current_lng).toBe(-118.2437);
      expect(result.accuracy).toBe(10);
      expect(result.driver_name).toBe('John D.');
      expect(result.vehicle_make).toBe('Toyota');
      expect(result.route_polyline).toBe(ROUTE_THROUGH_TEST_POINT);
      expect(result.status).toBe(BookingStatus.EN_ROUTE);
    });

    it('should throw if token is invalid', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(service.getPublicTrack('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if tracking link expired (over 1 hour after completion)', async () => {
      const oldCompletedBooking = {
        ...mockActiveBookingWithRelations,
        status: BookingStatus.COMPLETED,
        updated_at: new Date(Date.now() - 7200000).toISOString(),
      };
      bookingRepo.findOne.mockResolvedValue(oldCompletedBooking);

      await expect(service.getPublicTrack('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow tracking within 1 hour of completion', async () => {
      const recentCompletedBooking = {
        ...mockActiveBookingWithRelations,
        status: BookingStatus.COMPLETED,
        updated_at: new Date(Date.now() - 1800000).toISOString(),
      };
      bookingRepo.findOne.mockResolvedValue(recentCompletedBooking);
      pingRepo.findOne.mockResolvedValue(null);

      const result = await service.getPublicTrack('recent-token');

      expect(result.status).toBe(BookingStatus.COMPLETED);
    });
  });

  describe('respondToDeviation', () => {
    it('should update deviation status to RESPONDED_OK when response is ok', async () => {
      const mockDeviation = {
        id: 'dev-1',
        status: DeviationStatus.PENDING,
      } as DeviationEvent;

      deviationRepo.findOne.mockResolvedValue(mockDeviation);
      deviationRepo.save.mockResolvedValue({
        ...mockDeviation,
        status: DeviationStatus.RESPONDED_OK,
      });

      await service.respondToDeviation('dev-1', 'ok');

      expect(deviationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: DeviationStatus.RESPONDED_OK }),
      );
    });

    it('should throw if deviation event not found', async () => {
      deviationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.respondToDeviation('nonexistent', 'ok'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTrackingHistory', () => {
    it('should return pings ordered by timestamp ascending', async () => {
      const mockPings = [
        { id: 'ping-1', timestamp: '2024-01-01T00:00:00Z' },
        { id: 'ping-2', timestamp: '2024-01-01T00:00:30Z' },
      ] as TripPing[];
      pingRepo.find.mockResolvedValue(mockPings);

      const result = await service.getTrackingHistory('booking-1');

      expect(pingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { booking_id: 'booking-1' },
          order: { timestamp: 'ASC' },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('getDeviationHistory', () => {
    it('should return deviations ordered by created_at descending', async () => {
      const mockDeviations = [
        { id: 'dev-1', created_at: '2024-01-01T00:01:00Z' },
        { id: 'dev-2', created_at: '2024-01-01T00:00:00Z' },
      ] as DeviationEvent[];
      deviationRepo.find.mockResolvedValue(mockDeviations);

      const result = await service.getDeviationHistory('booking-1');

      expect(deviationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { booking_id: 'booking-1' },
          order: { created_at: 'DESC' },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('getMySOSHistory', () => {
    it('should return SOS events for user ordered by created_at descending', async () => {
      const mockSosEvents = [
        { id: 'sos-1', created_at: '2024-01-01T00:01:00Z' },
        { id: 'sos-2', created_at: '2024-01-01T00:00:00Z' },
      ] as SosEvent[];
      sosRepo.find.mockResolvedValue(mockSosEvents);

      const result = await service.getMySOSHistory('user-1');

      expect(sosRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'user-1' },
          order: { created_at: 'DESC' },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('checkTripOverruns', () => {
    withFakeTimers();

    it('should detect trips overrun by more than 60 minutes', async () => {
      const overrunBooking = {
        ...mockActiveBookingWithRelations,
        id: 'booking-overrun',
        status: BookingStatus.EN_ROUTE,
        trip: {
          ...mockTrip,
          expected_arrival_time: new Date(Date.now() - 7200000).toISOString(),
        },
      };

      bookingRepo.find.mockResolvedValue([overrunBooking]);
      deviationRepo.findOne.mockResolvedValue(null);
      deviationRepo.create.mockReturnValue({
        id: 'dev-overrun',
        booking_id: 'booking-overrun',
        status: DeviationStatus.PENDING,
      } as DeviationEvent);
      deviationRepo.save.mockResolvedValue({
        id: 'dev-overrun',
      } as DeviationEvent);

      await service.checkTripOverruns();

      expect(deviationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_id: 'booking-overrun',
          status: DeviationStatus.PENDING,
        }),
      );
      expect(notificationsService.send).toHaveBeenCalled();
    });

    it('should not create duplicate deviation events for same booking', async () => {
      const overrunBooking = {
        ...mockActiveBookingWithRelations,
        id: 'booking-overrun',
        status: BookingStatus.EN_ROUTE,
      };

      bookingRepo.find.mockResolvedValue([overrunBooking]);
      deviationRepo.findOne.mockResolvedValue({
        id: 'existing-dev',
      } as DeviationEvent);

      await service.checkTripOverruns();

      expect(deviationRepo.create).not.toHaveBeenCalled();
    });

    it('should skip trips without expected_arrival_time', async () => {
      const noEtaBooking = {
        ...mockActiveBookingWithRelations,
        trip: { ...mockTrip, expected_arrival_time: null },
        status: BookingStatus.EN_ROUTE,
      };

      bookingRepo.find.mockResolvedValue([noEtaBooking]);

      await service.checkTripOverruns();

      expect(deviationRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('storeRouteForTrip', () => {
    it('should store route polyline and coordinates for a trip', async () => {
      const expectedArrival = new Date(Date.now() + 3600000);

      await service.storeRouteForTrip(
        'trip-1',
        'encoded_polyline',
        expectedArrival,
        34.0522,
        -118.2437,
        33.9425,
        -118.4081,
      );

      expect(tripRepo.update).toHaveBeenCalledWith('trip-1', {
        mapbox_route_polyline: 'encoded_polyline',
        expected_arrival_time: expectedArrival.toISOString(),
        origin_lat: 34.0522,
        origin_lng: -118.2437,
        dest_lat: 33.9425,
        dest_lng: -118.4081,
      });
    });
  });
});
