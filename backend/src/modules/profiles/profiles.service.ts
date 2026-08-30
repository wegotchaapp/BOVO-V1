import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Profile,
  Vehicle,
  LuggageCapacity,
} from '../../database/entities/profile.entities';
import { User } from '../../database/entities/user.entity';
import { Verification } from '../../database/entities/identity.entities';
import {
  UpdateProfileDto,
  RegisterVehicleDto,
  UpdateVehicleDto,
} from './dto/profile.dto';
import { PinoLogger } from 'nestjs-pino';
import * as AWS from 'aws-sdk';
import { VehicleCategory } from '../../common/enums';
import { containsProfanity } from '../../common/utils/profanity-filter';
import {
  decodeVehicleCategory,
  VinDecodeResponse,
} from '../../common/utils/nhtsa-decoder';
import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_LANGUAGES = [
  'english',
  'spanish',
  'french',
  'mandarin',
  'hindi',
  'arabic',
  'portuguese',
  'russian',
  'japanese',
  'korean',
  'german',
  'dutch',
  'swahili',
];

const REQUIRED_PHOTOS = ['front_exterior', 'rear_exterior', 'interior'];
const MANDATORY_PHOTOS = ['front_exterior'];
const REQUIRED_DOCS = ['registration', 'insurance'];

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

@Injectable()
export class ProfilesService {
  private rekognition: AWS.Rekognition;
  private s3: AWS.S3;

  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.rekognition = new AWS.Rekognition({
      accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
      region: this.config.get('AWS_REGION'),
    });
    this.s3 = new AWS.S3({
      accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
      region: this.config.get('AWS_REGION'),
    });

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  }

  async getProfile(userId: string): Promise<Profile | null> {
    return this.profileRepo.findOne({ where: { user_id: userId } });
  }

  async getPublicProfile(userId: string): Promise<{
    id: string;
    display_name: string;
    profile_photo_url: string | null;
    bio: string | null;
    avg_rating: number | null;
    total_trips: number;
    badges: string[];
  }> {
    const profile = await this.profileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const badges = await this.computeBadges(userId);

    return {
      id: profile.id,
      display_name: profile.display_name,
      profile_photo_url: profile.profile_photo_url,
      bio: profile.bio,
      avg_rating: profile.avg_rating,
      total_trips: profile.total_trips,
      badges,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    let profile = await this.profileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      profile = this.profileRepo.create({ user_id: userId });
    }

    if (dto.bio) {
      if (dto.bio.length > 500) {
        throw new BadRequestException('Bio must be 500 characters or less');
      }
      if (containsProfanity(dto.bio)) {
        throw new BadRequestException('Bio contains inappropriate language');
      }
    }

    if (dto.languages && dto.languages.length > 0) {
      const invalid = dto.languages.filter(
        (lang) => !ALLOWED_LANGUAGES.includes(lang.toLowerCase()),
      );
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Invalid languages: ${invalid.join(', ')}`,
        );
      }
      dto.languages = dto.languages.map((l) => l.toLowerCase());
    }

    if (dto.display_name) {
      dto.display_name = dto.display_name.trim();
      if (dto.display_name.length < 2 || dto.display_name.length > 50) {
        throw new BadRequestException('Display name must be 2-50 characters');
      }
    }

    Object.assign(profile, dto);
    return this.profileRepo.save(profile);
  }

  async uploadProfilePhoto(
    userId: string,
    imageUrl: string,
  ): Promise<{ url: string; held_for_review: boolean }> {
    const bucket =
      this.config.get<string>('AWS_S3_BUCKET') || 'wegotcha-profiles';
    const imageKey = imageUrl.split('/').pop() || imageUrl;

    let moderationResult: any;
    let faceResult: any;

    try {
      moderationResult = await this.rekognition
        .detectModerationLabels({
          Image: { S3Object: { Bucket: bucket, Name: imageKey } },
        })
        .promise()
        .catch(() => ({ ModerationLabels: [] }));

      faceResult = await this.rekognition
        .detectFaces({
          Image: { S3Object: { Bucket: bucket, Name: imageKey } },
          Attributes: ['ALL'],
        })
        .promise()
        .catch(() => ({ FaceDetails: [] }));
    } catch {
      throw new BadRequestException('Unable to analyze image');
    }

    const flagged = (moderationResult.ModerationLabels || []).some(
      (label: { Confidence?: number }) => (label.Confidence || 0) > 80,
    );

    const hasFace = (faceResult.FaceDetails || []).length > 0;

    if (flagged) {
      this.logger.warn(
        { userId, imageUrl, labels: moderationResult.ModerationLabels },
        'Profile photo flagged for moderation',
      );
      return { url: imageUrl, held_for_review: true };
    }

    const profile = await this.profileRepo.findOne({
      where: { user_id: userId },
    });
    if (profile) {
      profile.profile_photo_url = imageUrl;
      await this.profileRepo.save(profile);
    }

    return { url: imageUrl, held_for_review: false };
  }

  async uploadProfilePhotoFromBase64(
    userId: string,
    base64Image: string,
    mimeType: string,
  ): Promise<{ url: string; held_for_review: boolean }> {
    const buffer = Buffer.from(base64Image, 'base64');
    const ext = mimeType.split('/')[1] || 'jpg';
    const key = `profiles/${userId}/${Date.now()}.${ext}`;
    const bucket =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET') || 'wegotcha-profiles';

    await this.uploadToSupabaseStorage(bucket, key, buffer, mimeType);

    const appUrl = this.config.get('APP_URL') || 'http://localhost:3000';
    const publicUrl = `${appUrl}/uploads/${bucket}/${key}`;

    const profile = await this.profileRepo.findOne({
      where: { user_id: userId },
    });
    if (profile) {
      profile.profile_photo_url = publicUrl;
      await this.profileRepo.save(profile);
    }

    const heldForReview = await this.moderateImageFromBuffer(buffer, mimeType);
    return { url: publicUrl, held_for_review: heldForReview.flagged };
  }

  async decodeVin(vin: string): Promise<{
    decoded: any[];
    category: string;
    luggage_class: string;
    max_passengers: number;
    reason: string;
  }> {
    const cleanVin = vin.trim().toUpperCase();
    if (cleanVin.length !== 17) {
      throw new BadRequestException('VIN must be 17 characters');
    }

    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(cleanVin)}?format=json`,
    );

    if (!response.ok) {
      throw new BadRequestException('NHTSA VIN decode service unavailable');
    }

    const data = (await response.json()) as VinDecodeResponse;

    if (!data.results || data.results.length === 0) {
      throw new BadRequestException(
        'Could not decode VIN — please enter vehicle details manually',
      );
    }

    const { category, luggage_class, max_passengers, reason } =
      decodeVehicleCategory(data.results);

    return {
      decoded: data.results,
      category,
      luggage_class,
      max_passengers,
      reason,
    };
  }

  async registerVehicle(
    userId: string,
    dto: RegisterVehicleDto,
  ): Promise<{
    vehicle: Vehicle;
    category_reason: string;
    vin_decoded: boolean;
  }> {
    let category = VehicleCategory.STANDARD_SEDAN;
    let luggageClass = 'medium';
    let maxPassengers = 4;
    let categoryReason = 'Default assignment — no VIN provided';
    let vinDecoded = false;

    if (dto.vin) {
      try {
        const decoded = await this.decodeVin(dto.vin);
        category = decoded.category as VehicleCategory;
        luggageClass = decoded.luggage_class;
        maxPassengers = decoded.max_passengers;
        categoryReason = decoded.reason;
        vinDecoded = true;

        if (dto.make && decoded.decoded.length > 0) {
          const nhtsaMake = decoded.decoded[0].make;
          if (nhtsaMake && dto.make.toLowerCase() !== nhtsaMake.toLowerCase()) {
            this.logger.warn(
              {
                userId,
                userMake: dto.make,
                nhtsaMake,
                vin: dto.vin,
              },
              'Vehicle make mismatch — user input differs from NHTSA decode',
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          { userId, error: err },
          'VIN decode failed, using defaults',
        );
      }
    }

    const vehicle = this.vehicleRepo.create({
      driver_id: userId,
      make: dto.make.trim(),
      model: dto.model.trim(),
      year: parseInt(dto.year, 10),
      color: dto.color.trim(),
      license_plate: dto.license_plate.trim(),
      state: dto.state.trim().toUpperCase(),
      vin: dto.vin ? dto.vin.trim().toUpperCase() : null,
      category,
      max_luggage_class: luggageClass as LuggageCapacity,
      max_passengers: maxPassengers,
      is_verified: false,
      photo_urls: {},
      documents: {},
      category_assignment_reason: categoryReason,
      category_manually_overridden: false,
    });

    const saved = await this.vehicleRepo.save(vehicle);

    this.logger.info(
      {
        vehicleId: saved.id,
        userId,
        category,
        vinDecoded,
        reason: categoryReason,
      },
      'Vehicle registered',
    );

    return {
      vehicle: saved,
      category_reason: categoryReason,
      vin_decoded: vinDecoded,
    };
  }

  async updateVehicle(
    userId: string,
    vehicleId: string,
    dto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id: vehicleId, driver_id: userId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (dto.year) {
      dto.year = String(parseInt(dto.year, 10));
    }

    if (dto.category && dto.category !== vehicle.category) {
      this.logger.info(
        {
          vehicleId,
          userId,
          oldCategory: vehicle.category,
          newCategory: dto.category,
        },
        'Vehicle category manually overridden',
      );
      vehicle.category_manually_overridden = true;
      vehicle.category_assignment_reason = `Manually overridden from ${vehicle.category} to ${dto.category}`;
    }

    Object.assign(vehicle, dto);
    return this.vehicleRepo.save(vehicle);
  }

  async uploadVehiclePhoto(
    userId: string,
    vehicleId: string,
    photoType: string,
    base64Image: string,
    mimeType: string,
  ): Promise<{ url: string; held_for_review: boolean }> {
    if (!REQUIRED_PHOTOS.includes(photoType)) {
      throw new BadRequestException(
        `Invalid photo type. Must be one of: ${REQUIRED_PHOTOS.join(', ')}`,
      );
    }

    const vehicle = await this.vehicleRepo.findOne({
      where: { id: vehicleId, driver_id: userId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const buffer = Buffer.from(base64Image, 'base64');

    const MAX_PHOTO_BYTES = 327680;
    if (buffer.length > MAX_PHOTO_BYTES) {
      throw new BadRequestException(
        `Photo exceeds maximum size of 320KB (${(buffer.length / 1024).toFixed(1)}KB uploaded)`,
      );
    }

    const ext = mimeType.split('/')[1] || 'jpg';
    const key = `vehicles/${vehicleId}/${photoType}.${ext}`;
    const bucket =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET') ||
      'wegotcha-vehicle-photos';

    const uploadResult = await this.uploadToSupabaseStorage(
      bucket,
      key,
      buffer,
      mimeType,
    );

    const appUrl = this.config.get('APP_URL') || 'http://localhost:3000';
    const publicUrl = `${appUrl}/uploads/${bucket}/${key}`;

    const moderationResult = await this.moderateImageFromBuffer(
      buffer,
      mimeType,
    );

    if (moderationResult.flagged) {
      this.logger.warn(
        { vehicleId, photoType, labels: moderationResult.labels },
        'Vehicle photo flagged for moderation',
      );
      return { url: publicUrl, held_for_review: true };
    }

    const photoUrls = { ...vehicle.photo_urls };
    photoUrls[photoType] = publicUrl;
    vehicle.photo_urls = photoUrls;

    await this.checkVehicleVerificationStatus(vehicle);

    const saved = await this.vehicleRepo.save(vehicle);

    return { url: publicUrl, held_for_review: false };
  }

  async uploadVehicleDocument(
    userId: string,
    vehicleId: string,
    docType: string,
    base64Image: string,
    mimeType: string,
    expiresAt?: string,
  ): Promise<{ storage_path: string; expires_at: string | null }> {
    if (!REQUIRED_DOCS.includes(docType)) {
      throw new BadRequestException(
        `Invalid document type. Must be one of: ${REQUIRED_DOCS.join(', ')}`,
      );
    }

    const vehicle = await this.vehicleRepo.findOne({
      where: { id: vehicleId, driver_id: userId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const buffer = Buffer.from(base64Image, 'base64');
    const ext = mimeType.split('/')[1] || 'jpg';
    const key = `vehicles/${vehicleId}/documents/${docType}.${ext}`;
    const bucket =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET_PRIVATE') ||
      'wegotcha-vehicle-docs';

    await this.uploadToSupabaseStorage(
      bucket,
      key,
      buffer,
      mimeType,
      'private',
    );

    const documents = { ...vehicle.documents };
    documents[docType] = {
      storage_path: key,
      expires_at: expiresAt || null,
    };
    vehicle.documents = documents;

    await this.checkVehicleVerificationStatus(vehicle);

    await this.vehicleRepo.save(vehicle);

    return { storage_path: key, expires_at: expiresAt || null };
  }

  async getVehicles(userId: string): Promise<Vehicle[]> {
    return this.vehicleRepo.find({
      where: { driver_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async getVehicle(userId: string, vehicleId: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id: vehicleId, driver_id: userId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  async deactivateVehicle(userId: string, vehicleId: string): Promise<void> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id: vehicleId, driver_id: userId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    await this.vehicleRepo.softDelete(vehicleId);
  }

  async computeBadges(userId: string): Promise<string[]> {
    const badges: string[] = [];

    const verification = await this.verificationRepo.findOne({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    if (verification?.status === 'verified') {
      const expiresAt = verification.expires_at
        ? new Date(verification.expires_at)
        : null;
      if (!expiresAt || expiresAt > new Date()) {
        badges.push('id_verified');
      }
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'subscription_tier'],
    });

    if (user?.subscription_tier === 'premium') {
      badges.push('premium_member');
    }

    const verifiedVehicleCount = await this.vehicleRepo.count({
      where: { driver_id: userId, is_verified: true },
    });

    if (verifiedVehicleCount > 0) {
      badges.push('vehicle_verified');
    }

    const profile = await this.profileRepo.findOne({
      where: { user_id: userId },
    });

    if (
      profile &&
      (profile.avg_rating || 0) >= 4.5 &&
      (profile.total_trips || 0) >= 10
    ) {
      badges.push('top_rated');
    }

    return badges;
  }

  private async moderateImageFromBuffer(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ flagged: boolean; labels: any[] }> {
    try {
      const result = await this.rekognition
        .detectModerationLabels({
          Image: { Bytes: buffer },
          MinConfidence: 50,
        })
        .promise();

      const flagged = (result.ModerationLabels || []).some(
        (label: { Confidence?: number }) => (label.Confidence || 0) > 80,
      );

      return {
        flagged,
        labels: result.ModerationLabels || [],
      };
    } catch {
      return { flagged: false, labels: [] };
    }
  }

  private async uploadToSupabaseStorage(
    bucket: string,
    key: string,
    buffer: Buffer,
    mimeType: string,
    acl: 'public' | 'private' = 'public',
  ): Promise<void> {
    const awsKey = this.config.get('AWS_ACCESS_KEY_ID');
    const awsSecret = this.config.get('AWS_SECRET_ACCESS_KEY');

    if (awsKey && awsSecret && awsKey !== 'AKIA_local_mock') {
      const s3Params = {
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ACL: acl === 'public' ? 'public-read' : 'private',
      };
      await this.s3.putObject(s3Params).promise();
      return;
    }

    const filePath = path.join(UPLOADS_DIR, bucket, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
  }

  private async checkVehicleVerificationStatus(
    vehicle: Vehicle,
  ): Promise<void> {
    const photoUrls = vehicle.photo_urls || {};
    const documents = vehicle.documents || {};

    const requiredPhotosComplete = MANDATORY_PHOTOS.every(
      (type) => photoUrls[type] && photoUrls[type].length > 0,
    );

    const registrationDoc = documents.registration;
    const insuranceDoc = documents.insurance;

    const now = new Date();

    const registrationValid =
      registrationDoc &&
      (!registrationDoc.expires_at ||
        new Date(registrationDoc.expires_at) > now);

    const insuranceValid =
      insuranceDoc &&
      (!insuranceDoc.expires_at || new Date(insuranceDoc.expires_at) > now);

    const allDocsValid = registrationValid && insuranceValid;

    if (requiredPhotosComplete && allDocsValid && !vehicle.is_verified) {
      vehicle.is_verified = true;
      this.logger.info(
        { vehicleId: vehicle.id },
        'Vehicle verification badge awarded',
      );
    } else if (
      (!requiredPhotosComplete || !allDocsValid) &&
      vehicle.is_verified
    ) {
      vehicle.is_verified = false;
      this.logger.info(
        { vehicleId: vehicle.id },
        'Vehicle verification badge removed',
      );
    }
  }
}
