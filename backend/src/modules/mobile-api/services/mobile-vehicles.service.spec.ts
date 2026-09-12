import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { MobileVehicle } from '../entities/mobile.entities';
import {
  MAX_VEHICLES_PER_USER,
  MobileVehiclesService,
} from './mobile-vehicles.service';

const VIN = '1HGCM82633A004352';
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';

const details = {
  make: 'Toyota',
  model: 'Camry',
  year: 2022,
  color: 'Silver',
  licensePlate: 'abc1234',
  state: 'TX',
  vin: VIN,
  seatCount: 3,
  doorCount: 4,
};

/** A vehicle with every requirement met. */
function complete(overrides: Partial<MobileVehicle> = {}): MobileVehicle {
  return {
    id: VEHICLE_ID,
    user_id: USER,
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    color: 'Silver',
    license_plate: 'ABC1234',
    state: 'TX',
    vin: VIN,
    seat_count: 3,
    door_count: 4,
    photo_front_url: 'front',
    photo_rear_url: 'rear',
    photo_left_url: 'left',
    photo_right_url: 'right',
    photo_interior_url: 'interior',
    insurance_doc_url: 'insurance',
    insurance_expires_at: null,
    registration_doc_url: 'registration',
    registration_expires_at: null,
    verification_status: 'approved',
    verification_note: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function build() {
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const vehicles = {
    count: jest.fn(),
    create: jest.fn((init: Partial<MobileVehicle>) => ({ ...init })),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((row: MobileVehicle) =>
      Promise.resolve({
        ...row,
        created_at: new Date(),
        updated_at: new Date(),
      }),
    ),
  };
  const service = new MobileVehiclesService(config as never, vehicles as never);
  return { service, vehicles };
}

describe('MobileVehiclesService — several vehicles per Voyager', () => {
  it('refuses a vehicle past the per-account limit', async () => {
    const { service, vehicles } = build();
    vehicles.count.mockResolvedValue(MAX_VEHICLES_PER_USER);

    await expect(service.create(USER, details)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(vehicles.save).not.toHaveBeenCalled();
  });

  it('adds a second vehicle as a new, incomplete record', async () => {
    const { service, vehicles } = build();
    vehicles.count.mockResolvedValue(1);
    vehicles.findOne.mockResolvedValue(null);

    const { vehicle } = await service.create(USER, details);

    expect(vehicles.create).toHaveBeenCalledWith({ user_id: USER });
    expect(vehicle.verificationStatus).toBe('incomplete');
    expect(vehicle.licensePlate).toBe('ABC1234');
  });

  it('tells a Voyager they already added that VIN', async () => {
    const { service, vehicles } = build();
    vehicles.count.mockResolvedValue(1);
    vehicles.findOne.mockResolvedValue(complete());

    await expect(service.create(USER, details)).rejects.toThrow(
      "You've already added a vehicle with that VIN.",
    );
  });

  it("refuses a VIN registered to someone else's account", async () => {
    const { service, vehicles } = build();
    vehicles.count.mockResolvedValue(0);
    vehicles.findOne.mockResolvedValue(complete({ user_id: OTHER }));

    await expect(service.create(USER, details)).rejects.toThrow(
      'That VIN is already registered to another Bovogo account.',
    );
  });
});

describe('MobileVehiclesService — approved vehicles are locked', () => {
  it('refuses to edit an approved vehicle', async () => {
    const { service, vehicles } = build();
    vehicles.findOne.mockResolvedValue(complete());

    await expect(
      service.update(USER, VEHICLE_ID, details),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(vehicles.save).not.toHaveBeenCalled();
  });

  it('refuses a photo upload on an approved vehicle', async () => {
    const { service, vehicles } = build();
    vehicles.findOne.mockResolvedValue(complete());

    await expect(
      service.uploadPhoto(USER, VEHICLE_ID, 'front', undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a MIME type inherited from Object.prototype', async () => {
    // The type comes straight off the multipart part. Looked up on an object
    // literal, `constructor` resolved to a truthy value from the prototype,
    // passed for a supported format, and was interpolated into the stored key.
    const { service, vehicles } = build();
    vehicles.findOne.mockResolvedValue(
      complete({ verification_status: 'pending_review' }),
    );

    await expect(
      service.uploadPhoto(USER, VEHICLE_ID, 'front', {
        buffer: Buffer.from('photo'),
        mimetype: 'constructor',
        originalname: 'front.jpg',
        size: 5,
      }),
    ).rejects.toThrow(/Unsupported photo format/);
  });

  it("does not reveal another Voyager's vehicle", async () => {
    const { service, vehicles } = build();
    vehicles.findOne.mockResolvedValue(
      complete({ user_id: OTHER, verification_status: 'pending_review' }),
    );

    await expect(
      service.update(USER, VEHICLE_ID, details),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sends a fixed rejected vehicle back for review and clears the old note', async () => {
    const { service, vehicles } = build();
    const rejected = complete({
      verification_status: 'rejected',
      verification_note: 'Plate unreadable',
    });
    // First lookup by id, second by VIN — the same row, so there is no clash.
    vehicles.findOne
      .mockResolvedValueOnce(rejected)
      .mockResolvedValueOnce(rejected);

    const { vehicle } = await service.update(USER, VEHICLE_ID, details);

    expect(vehicle.verificationStatus).toBe('pending_review');
    expect(vehicle.verificationNote).toBeNull();
  });
});

describe('MobileVehiclesService.assertReadyToDrive', () => {
  it('uses an approved vehicle even when a newer one is still under review', async () => {
    const { service, vehicles } = build();
    const approved = complete({ id: 'approved' });
    vehicles.find.mockResolvedValue([
      complete({ id: 'newer', verification_status: 'pending_review' }),
      approved,
    ]);

    await expect(service.assertReadyToDrive(USER)).resolves.toBe(approved);
  });

  it('explains the newest vehicle when none is approved', async () => {
    const { service, vehicles } = build();
    vehicles.find.mockResolvedValue([
      complete({ verification_status: 'pending_review' }),
    ]);

    await expect(service.assertReadyToDrive(USER)).rejects.toThrow(
      "Your vehicle is being reviewed. You can post as soon as it's approved.",
    );
  });

  it('refuses a chosen vehicle that belongs to someone else', async () => {
    const { service, vehicles } = build();
    vehicles.findOne.mockResolvedValue(complete({ user_id: OTHER }));

    await expect(
      service.assertReadyToDrive(USER, VEHICLE_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a malformed vehicle id without querying', async () => {
    const { service, vehicles } = build();

    await expect(
      service.assertReadyToDrive(USER, 'not-a-uuid'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(vehicles.findOne).not.toHaveBeenCalled();
  });
});
