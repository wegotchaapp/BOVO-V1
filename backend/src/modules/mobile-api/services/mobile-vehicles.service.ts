import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as AWS from 'aws-sdk';

import { MobileVehicle } from '../entities/mobile.entities';
import { UpsertVehicleBody } from '../dto/mobile.dto';
import { vehicleToDto } from '../mobile.mappers';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const VEHICLE_BUCKET = 'bovogo-vehicle-media';

const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
};
/** Documents may also be photographed, so images are accepted alongside PDF. */
const ALLOWED_DOC_MIME: Record<string, string> = {
  ...ALLOWED_IMAGE_MIME,
  'application/pdf': 'pdf',
};

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
  private readonly s3: AWS.S3;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(MobileVehicle)
    private readonly vehicles: Repository<MobileVehicle>,
  ) {
    this.s3 = new AWS.S3({
      accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
      region: this.config.get('AWS_REGION'),
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

  /** Upsert the Voyager's single primary vehicle. */
  async upsert(userId: string, dto: UpsertVehicleBody) {
    const vin = normaliseVin(dto.vin);
    if (!VIN_PATTERN.test(vin)) {
      throw new BadRequestException(
        'Enter a valid 17-character VIN. It uses letters and numbers but never the letters I, O or Q.',
      );
    }

    // A VIN identifies one physical car, so it cannot belong to two accounts.
    const clash = await this.vehicles.findOne({ where: { vin } });
    if (clash && clash.user_id !== userId) {
      throw new BadRequestException(
        'That VIN is already registered to another Bovogo account.',
      );
    }

    const existing = await this.vehicles.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
      take: 1,
    });
    const row = existing[0] ?? this.vehicles.create({ user_id: userId });

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

    const saved = await this.save(row);
    return { vehicle: vehicleToDto(saved, missingRequirements(saved)) };
  }

  async uploadPhoto(
    userId: string,
    slot: string,
    file: UploadedFile | undefined,
  ) {
    if (!isPhotoSlot(slot)) {
      throw new BadRequestException(
        `Unknown photo slot "${slot}". Expected one of: ${PHOTO_SLOTS.join(', ')}.`,
      );
    }
    const row = await this.requireVehicle(userId);
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
    kind: string,
    expiresAt: string | undefined,
    file: UploadedFile | undefined,
  ) {
    if (!isDocKind(kind)) {
      throw new BadRequestException(
        `Unknown document "${kind}". Expected one of: ${DOC_KINDS.join(', ')}.`,
      );
    }
    const row = await this.requireVehicle(userId);
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
   * Throws unless the Voyager has a vehicle that satisfies every requirement.
   * Called before an adventure may be posted.
   */
  async assertReadyToDrive(userId: string): Promise<MobileVehicle> {
    const rows = await this.vehicles.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
      take: 1,
    });
    const row = rows[0];
    if (!row) {
      throw new BadRequestException(
        'Add your vehicle before posting an adventure.',
      );
    }
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

  /** Recomputes review state from completeness, then persists. */
  private async save(row: MobileVehicle) {
    const missing = missingRequirements(row);
    if (missing.length > 0) {
      row.verification_status = 'incomplete';
    } else if (row.verification_status === 'incomplete') {
      // Everything supplied for the first time — hand to ops.
      row.verification_status = 'pending_review';
    }
    return this.vehicles.save(row);
  }

  private async requireVehicle(userId: string): Promise<MobileVehicle> {
    const rows = await this.vehicles.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
      take: 1,
    });
    if (!rows[0]) {
      throw new BadRequestException(
        'Save your vehicle details before uploading photos or documents.',
      );
    }
    return rows[0];
  }

  private assertFile(
    file: UploadedFile | undefined,
    allowed: Record<string, string>,
    label: string,
  ): string {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException(`A ${label} file is required.`);
    }
    const ext = allowed[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        `Unsupported ${label} format. Accepted: ${Object.keys(allowed).join(', ')}.`,
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
      await this.s3
        .putObject({
          Bucket: VEHICLE_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ACL: 'private',
        })
        .promise();
      return;
    }

    const filePath = path.join(UPLOADS_DIR, VEHICLE_BUCKET, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, buffer);
  }
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
