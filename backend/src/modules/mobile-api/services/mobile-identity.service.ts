import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { PrivateMediaService } from '../../private-media/private-media.service';
import {
  MobileIdentityVerification,
  MobileUser,
} from '../entities/mobile.entities';
import { SubmitIdentityVerificationBody } from '../dto/mobile.dto';
import { identityVerificationToDto } from '../mobile.mappers';

export interface IdentityFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface IdentityUpload {
  idFront?: IdentityFile[];
  idBack?: IdentityFile[];
  selfie?: IdentityFile[];
}

/**
 * A `Map`, not an object literal: the MIME type comes straight off a multipart
 * part, so `constructor` or `toString` would otherwise resolve to a truthy
 * value from `Object.prototype` and pass for a supported image type.
 */
const EXT_BY_MIME = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/heic', 'heic'],
]);

/** Postgres unique violation — two submissions racing the one-pending index. */
const UNIQUE_VIOLATION = '23505';

/**
 * Government ID and selfie submissions. The images never become URLs: they go
 * to private storage under keys only the backend holds, and only the admin
 * review routes can read them back.
 */
@Injectable()
export class MobileIdentityService {
  private readonly logger = new Logger(MobileIdentityService.name);

  constructor(
    @InjectRepository(MobileIdentityVerification)
    private readonly verifications: Repository<MobileIdentityVerification>,
    private readonly media: PrivateMediaService,
    private readonly dataSource: DataSource,
  ) {}

  /** The latest submission, or null when the user has never sent one. */
  async latest(userId: string) {
    const row = await this.findLatest(userId);
    return { verification: row ? identityVerificationToDto(row) : null };
  }

  async submit(
    userId: string,
    dto: SubmitIdentityVerificationBody,
    upload: IdentityUpload,
  ) {
    // The cheap check: it costs one query and spares the caller three uploads.
    // It is not the one that decides — see the recheck under the lock below.
    assertSubmittable(await this.findLatest(userId));

    const idFront = assertImage(upload.idFront?.[0], 'front of your ID');
    const selfie = assertImage(upload.selfie?.[0], 'selfie');
    // A passport has no back; the other documents do.
    const needsBack = dto.documentType !== 'passport';
    const idBack = needsBack
      ? assertImage(upload.idBack?.[0], 'back of your ID')
      : null;

    // One folder per submission, so a resubmission never overwrites the images
    // a reviewer is looking at.
    const folder = `identity/${userId}/${randomUUID()}`;
    const row = this.verifications.create({
      user_id: userId,
      status: 'pending_review',
      document_type: dto.documentType,
      submitted_at: new Date(),
      id_front_key: `${folder}/id-front.${ext(idFront)}`,
      id_back_key: idBack ? `${folder}/id-back.${ext(idBack)}` : null,
      selfie_key: `${folder}/selfie.${ext(selfie)}`,
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    });

    // Every key `put` was asked for, recorded *before* the call. A put that
    // times out may still have landed the object, so an attempted key is as
    // likely to need erasing as a confirmed one — and erasing a key that was
    // never written is free, because `remove` ignores a missing object.
    const attempted: string[] = [];
    try {
      attempted.push(row.id_front_key);
      await this.media.put(row.id_front_key, idFront.buffer, idFront.mimetype);
      if (idBack && row.id_back_key) {
        attempted.push(row.id_back_key);
        await this.media.put(row.id_back_key, idBack.buffer, idBack.mimetype);
      }
      attempted.push(row.selfie_key);
      await this.media.put(row.selfie_key, selfie.buffer, selfie.mimetype);

      // The account row is locked for the insert so a purge running its own
      // transaction cannot finish underneath it. `mobile_identity_verifications`
      // has no foreign key to the user, so nothing else would stop a submission
      // landing a moment after the account it belongs to was erased — and that
      // row, with its images, would then be unreachable by any purge or review.
      const saved = await this.dataSource.transaction(async (tx) => {
        const owner = await tx.getRepository(MobileUser).findOne({
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!owner) {
          throw new UnauthorizedException('This account no longer exists.');
        }
        if (owner.deletion_requested_at) {
          throw new ConflictException(
            'Your account is scheduled for deletion. Cancel that in Settings before verifying your ID.',
          );
        }
        const verifications = tx.getRepository(MobileIdentityVerification);
        // Recheck under the lock, which is what actually decides. The status
        // can have moved on since the cheap check: two submissions can both
        // pass it, and the partial unique index only covers `pending_review`,
        // so an admin approving the first would not stop the second landing a
        // fresh pending row on top of an approved identity.
        assertSubmittable(await this.findLatest(userId, verifications));
        return verifications.save(row);
      });
      return { verification: identityVerificationToDto(saved) };
    } catch (error: unknown) {
      // Never leave someone's ID in storage for a submission that was not
      // recorded — there would be nothing left pointing at it to delete.
      await this.compensate(userId, attempted);
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          "Your ID is already being reviewed. We'll update you when it's done.",
        );
      }
      throw error;
    }
  }

  /**
   * Erases every submission and stored image for a user, inside the caller's
   * transaction. The images go first, and a failed removal aborts the purge, so
   * the rows holding the only copy of those keys survive for the next attempt.
   * Called by the account purge, which deletes the user row in the same
   * transaction.
   */
  async purge(userId: string, manager: EntityManager): Promise<void> {
    const repo = manager.getRepository(MobileIdentityVerification);
    const rows = await repo.find({ where: { user_id: userId } });
    if (rows.length === 0) return;

    const keys = rows.flatMap((row) =>
      [row.id_front_key, row.id_back_key, row.selfie_key].filter(
        (key): key is string => !!key,
      ),
    );

    let failed = 0;
    for (const key of keys) {
      try {
        await this.media.remove(key);
      } catch {
        failed += 1;
      }
    }
    if (failed > 0) {
      // Deleting the rows now would strand those images with nothing pointing
      // at them. Roll the whole purge back instead; it is safe to retry.
      this.logger.error(
        `Account purge aborted for user ${userId}: ${failed} of ${keys.length} identity images could not be erased.`,
      );
      throw new ServiceUnavailableException(
        "We couldn't finish erasing your identity documents, so the account deletion was rolled back. Please try again shortly.",
      );
    }
    await repo.delete({ user_id: userId });
  }

  /**
   * Removes every image this submission tried to write, for a submission that
   * was never recorded. There is no row left to retry from, so a failure is
   * logged loudly — by user and count, never by key, which is what
   * `PrivateQueryLogger` exists to keep out of logs. That log line is the only
   * handle on the leftovers: recovery is a person listing
   * `identity/<userId>/` and erasing the folders that match no row of that
   * user's. Nothing retries it automatically.
   */
  private async compensate(userId: string, keys: string[]): Promise<void> {
    let failed = 0;
    for (const key of keys) {
      try {
        await this.media.remove(key);
      } catch {
        failed += 1;
      }
    }
    if (failed > 0) {
      this.logger.error(
        `Orphaned identity media: ${failed} of ${keys.length} images for user ${userId} survived a failed submission and need erasing by hand under identity/${userId}/.`,
      );
    }
  }

  private findLatest(
    userId: string,
    repo: Repository<MobileIdentityVerification> = this.verifications,
  ) {
    return repo.findOne({
      where: { user_id: userId },
      order: { submitted_at: 'DESC' },
    });
  }
}

/** Throws unless the user's newest submission leaves room for another one. */
function assertSubmittable(
  latest: MobileIdentityVerification | null | undefined,
): void {
  if (latest?.status === 'pending_review') {
    throw new ConflictException(
      "Your ID is already being reviewed. We'll update you when it's done.",
    );
  }
  if (latest?.status === 'approved') {
    throw new ConflictException('Your identity is already verified.');
  }
}

function ext(file: IdentityFile): string {
  // `assertImage` has already rejected anything not in the map.
  return EXT_BY_MIME.get(file.mimetype)!;
}

function assertImage(
  file: IdentityFile | undefined,
  label: string,
): IdentityFile {
  if (!file || !file.buffer?.length) {
    throw new BadRequestException(`A photo of the ${label} is required.`);
  }
  if (!EXT_BY_MIME.has(file.mimetype)) {
    throw new BadRequestException(
      `That ${label} isn't a supported image. Use JPEG, PNG, WebP or HEIC.`,
    );
  }
  return file;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}
