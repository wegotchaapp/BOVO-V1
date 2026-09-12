import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { MobileVehicle } from '../entities/mobile.entities';
import { UpsertVehicleBody } from '../dto/mobile.dto';
import { vehicleToDto } from '../mobile.mappers';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const VEHICLE_BUCKET = 'bovogo-vehicle-media';

/** Enough for a household's cars; stops one account flooding the review queue. */
export const MAX_VEHICLES_PER_USER = 5;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `Map`s, not object literals: the MIME type comes straight off a multipart
 * part, so a lookup by `constructor` or `__proto__` would otherwise return a
 * truthy value inherited from `Object.prototype`, pass for a supported format,
 * and end up interpolated into the stored key and its URL.
 */
const ALLOWED_IMAGE_MIME = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/heic', 'heic'],
  ['image/webp', 'webp'],
]);
/** Documents may also be photographed, so images are accepted alongside PDF. */
const ALLOWED_DOC_MIME = new Map<string, string>([
  ...ALLOWED_IMAGE_MIME,
  ['application/pdf', 'pdf'],
]);

export const PHOTO_SLOTS = [
  'front',
  'rear',
  'left',
  'right',
  'interior',
] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];

export const DOC_KINDS = ['insurance', 'registration'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

const PHOTO_COLUMN: Record<PhotoSlot, keyof MobileVehicle> = {
  front: 'photo_front_url',
  rear: 'photo_rear_url',
  left: 'photo_left_url',
  right: 'photo_right_url',
  interior: 'photo_interior_url',
};

const PHOTO_LABEL: Record<PhotoSlot, string> = {
  front: 'Front of the vehicle',
  rear: 'Rear of the vehicle',
  left: "Driver's side",
  right: "Passenger's side",
  interior: 'Interior',
};

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/**
 * A VIN is 17 characters and never contains I, O or Q — those were excluded
 * from the standard precisely because they are mistaken for 1 and 0.
 */
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normaliseVin(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '');
}

@Injectable()
export class MobileVehiclesService {
  private readonly s3: S3Client;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(MobileVehicle)
    private readonly vehicles: Repository<MobileVehicle>,
  ) {
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_REGION'),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  async mine(userId: string) {
    const rows = await this.vehicles.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
    });
    return {
      vehicles: rows.map((v) => vehicleToDto(v, missingRequirements(v))),
    };
  }

  /** Registers another vehicle. Each one is reviewed on its own. */
  async create(userId: string, dto: UpsertVehicleBody) {
    const count = await this.vehicles.count({ where: { user_id: userId } });
    if (count >= MAX_VEHICLES_PER_USER) {
      throw new BadRequestException(
        `You can register up to ${MAX_VEHICLES_PER_USER} vehicles.`,
      );
    }
    const vin = await this.assertVinAvailable(userId, dto.vin, null);

    const row = this.vehicles.create({ user_id: userId });
    applyDetails(row, dto, vin);
    const saved = await this.save(row);
    return { vehicle: vehicleToDto(saved, missingRequirements(saved)) };
  }

  /** Edits a vehicle that has not been approved yet. */
  async update(userId: string, id: string, dto: UpsertVehicleBody) {
    const row = await this.requireEditableVehicle(userId, id);
    const vin = await this.assertVinAvailable(userId, dto.vin, row.id);

    applyDetails(row, dto, vin);
    const saved = await this.save(row);
    return { vehicle: vehicleToDto(saved, missingRequirements(saved)) };
  }

  async uploadPhoto(
    userId: string,
    vehicleId: string,
    slot: string,
    file: UploadedFile | undefined,
  ) {
    if (!isPhotoSlot(slot)) {
      throw new BadRequestException(
        `Unknown photo slot "${slot}". Expected one of: ${PHOTO_SLOTS.join(', ')}.`,
      );
    }
    const row = await this.requireEditableVehicle(userId, vehicleId);
    const ext = this.assertFile(file, ALLOWED_IMAGE_MIME, 'photo');

    const key = `vehicles/${row.id}/${slot}-${randomUUID()}.${ext}`;
    await this.store(key, file!.buffer, file!.mimetype);
    (row as unknown as Record<string, unknown>)[PHOTO_COLUMN[slot]] =
      this.publicUrl(key);

    const saved = await this.save(row);
    return {
      ok: true,
      slot,
      vehicle: vehicleToDto(saved, missingRequirements(saved)),
    };
  }

  async uploadDocument(
    userId: string,
    vehicleId: string,
    kind: string,
    expiresAt: string | undefined,
    file: UploadedFile | undefined,
  ) {
    if (!isDocKind(kind)) {
      throw new BadRequestException(
        `Unknown document "${kind}". Expected one of: ${DOC_KINDS.join(', ')}.`,
      );
    }
    const row = await this.requireEditableVehicle(userId, vehicleId);
    const ext = this.assertFile(file, ALLOWED_DOC_MIME, 'document');

    const key = `vehicles/${row.id}/${kind}-${randomUUID()}.${ext}`;
    await this.store(key, file!.buffer, file!.mimetype);

    if (kind === 'insurance') {
      row.insurance_doc_url = this.publicUrl(key);
      if (expiresAt) row.insurance_expires_at = expiresAt;
    } else {
      row.registration_doc_url = this.publicUrl(key);
      if (expiresAt) row.registration_expires_at = expiresAt;
    }

    const saved = await this.save(row);
    return {
      ok: true,
      kind,
      vehicle: vehicleToDto(saved, missingRequirements(saved)),
    };
  }

  async getOne(userId: string, id: string) {
    const row = await this.vehicles.findOne({ where: { id } });
    if (!row || row.user_id !== userId) {
      throw new NotFoundException('Vehicle not found');
    }
    return { vehicle: vehicleToDto(row, missingRequirements(row)) };
  }

  /**
   * Throws unless the Voyager has an approved vehicle that satisfies every
   * requirement. Called before an adventure may be posted. With a `vehicleId`
   * that vehicle must be the one; without, any approved vehicle will do.
   */
  async assertReadyToDrive(
    userId: string,
    vehicleId?: string,
  ): Promise<MobileVehicle> {
    if (vehicleId) {
      const row = UUID_PATTERN.test(vehicleId)
        ? await this.vehicles.findOne({ where: { id: vehicleId } })
        : null;
      if (!row || row.user_id !== userId) {
        throw new BadRequestException(
          'Choose one of your own vehicles for this adventure.',
        );
      }
      return assertDrivable(row);
    }

    const rows = await this.vehicles.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
    });
    if (rows.length === 0) {
      throw new BadRequestException(
        'Add your vehicle before posting an adventure.',
      );
    }
    const ready = rows.find(
      (r) =>
        r.verification_status === 'approved' &&
        missingRequirements(r).length === 0,
    );
    // Nothing ready: explain what the most recently touched vehicle still needs.
    return assertDrivable(ready ?? rows[0]);
  }

  /** Recomputes review state from completeness, then persists. */
  private async save(row: MobileVehicle) {
    const missing = missingRequirements(row);
    if (missing.length > 0) {
      row.verification_status = 'incomplete';
    } else if (
      row.verification_status === 'incomplete' ||
      row.verification_status === 'rejected'
    ) {
      // Complete for the first time, or fixed after a rejection — hand to ops.
      // A rejected vehicle used to stay rejected however much it changed, so it
      // could never be posted with again.
      row.verification_status = 'pending_review';
      row.verification_note = null;
    }
    return this.vehicles.save(row);
  }

  /**
   * The vehicle, if it belongs to this Voyager and can still be changed.
   * Approved vehicles are locked: what ops checked is what Sailors ride in.
   */
  private async requireEditableVehicle(
    userId: string,
    id: string,
  ): Promise<MobileVehicle> {
    const row = await this.vehicles.findOne({ where: { id } });
    if (!row || row.user_id !== userId) {
      throw new NotFoundException('Vehicle not found');
    }
    if (row.verification_status === 'approved') {
      throw new ForbiddenException(
        "Approved vehicles can't be edited. Contact support if something about this vehicle has changed.",
      );
    }
    return row;
  }

  /** Normalises the VIN and checks nobody — including this Voyager — has it. */
  private async assertVinAvailable(
    userId: string,
    rawVin: string,
    ownVehicleId: string | null,
  ): Promise<string> {
    const vin = normaliseVin(rawVin);
    if (!VIN_PATTERN.test(vin)) {
      throw new BadRequestException(
        'Enter a valid 17-character VIN. It uses letters and numbers but never the letters I, O or Q.',
      );
    }

    // A VIN identifies one physical car, so it can be registered only once.
    const clash = await this.vehicles.findOne({ where: { vin } });
    if (clash && clash.id !== ownVehicleId) {
      throw new BadRequestException(
        clash.user_id === userId
          ? "You've already added a vehicle with that VIN."
          : 'That VIN is already registered to another Bovogo account.',
      );
    }
    return vin;
  }

  private assertFile(
    file: UploadedFile | undefined,
    allowed: Map<string, string>,
    label: string,
  ): string {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException(`A ${label} file is required.`);
    }
    const ext = allowed.get(file.mimetype);
    if (!ext) {
      throw new BadRequestException(
        `Unsupported ${label} format. Accepted: ${[...allowed.keys()].join(', ')}.`,
      );
    }
    return ext;
  }

  private publicUrl(key: string): string {
    const appUrl = this.config.get('APP_URL') || 'http://localhost:3000';
    return `${appUrl}/uploads/${VEHICLE_BUCKET}/${key}`;
  }

  /** Real S3 when credentials are configured, local disk otherwise. */
  private async store(key: string, buffer: Buffer, mimeType: string) {
    const awsKey = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const awsSecret = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const hasRealAwsCreds =
      !!awsKey && !!awsSecret && /^AKIA[0-9A-Z]{16}$/.test(awsKey);

    if (hasRealAwsCreds) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: VEHICLE_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ACL: 'private',
        }),
      );
      return;
    }

    const filePath = path.join(UPLOADS_DIR, VEHICLE_BUCKET, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, buffer);
  }
}

function applyDetails(
  row: MobileVehicle,
  dto: UpsertVehicleBody,
  vin: string,
): void {
  row.make = dto.make.trim();
  row.model = dto.model.trim();
  row.year = dto.year;
  row.color = dto.color.trim();
  row.license_plate = dto.licensePlate.trim().toUpperCase();
  row.state = (dto.state ?? 'TX').trim().toUpperCase().slice(0, 2);
  row.vin = vin;
  row.seat_count = dto.seatCount;
  row.door_count = dto.doorCount;
  if (dto.insuranceExpiresAt !== undefined) {
    row.insurance_expires_at = dto.insuranceExpiresAt || null;
  }
  if (dto.registrationExpiresAt !== undefined) {
    row.registration_expires_at = dto.registrationExpiresAt || null;
  }
}

/** The posting gate: complete, and approved by a person. */
function assertDrivable(row: MobileVehicle): MobileVehicle {
  const missing = missingRequirements(row);
  if (missing.length > 0) {
    throw new BadRequestException(
      `Your vehicle isn't ready yet. Still needed: ${missing.join(', ')}.`,
    );
  }
  // Documents being present is not the same as somebody having looked at them.
  // Sailors are told vehicles are checked before they ride, so the check has to
  // be the thing that opens the gate.
  if (row.verification_status === 'rejected') {
    throw new BadRequestException(
      row.verification_note
        ? `Your vehicle needs attention: ${row.verification_note}`
        : 'Your vehicle was rejected. Update it and resubmit.',
    );
  }
  if (row.verification_status !== 'approved') {
    throw new BadRequestException(
      "Your vehicle is being reviewed. You can post as soon as it's approved.",
    );
  }
  return row;
}

function isPhotoSlot(v: string): v is PhotoSlot {
  return (PHOTO_SLOTS as readonly string[]).includes(v);
}

function isDocKind(v: string): v is DocKind {
  return (DOC_KINDS as readonly string[]).includes(v);
}

/**
 * Human-readable list of what the vehicle is still missing. Empty means ready.
 * This is the single definition of "complete" — the UI checklist, the save
 * hook and the posting gate all read from it, so they cannot disagree.
 */
export function missingRequirements(v: MobileVehicle): string[] {
  const missing: string[] = [];

  if (!v.vin || !VIN_PATTERN.test(v.vin)) missing.push('VIN');
  if (!v.seat_count || v.seat_count < 1) missing.push('number of seats');
  if (!v.door_count || v.door_count < 1) missing.push('number of doors');

  for (const slot of PHOTO_SLOTS) {
    if (!v[PHOTO_COLUMN[slot]]) missing.push(`photo: ${PHOTO_LABEL[slot]}`);
  }

  if (!v.insurance_doc_url) missing.push('insurance certificate');
  else if (isExpired(v.insurance_expires_at))
    missing.push('valid (unexpired) insurance');

  if (!v.registration_doc_url) missing.push('vehicle registration');
  else if (isExpired(v.registration_expires_at))
    missing.push('valid (unexpired) registration');

  return missing;
}

function isExpired(date: string | null): boolean {
  if (!date) return false; // no expiry recorded — not treated as expired
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}
