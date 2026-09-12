import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  MobileIdentityVerification,
  MobileUser,
} from '../mobile-api/entities/mobile.entities';
import { AuditEvent } from '../../database/entities/audit.entity';
import { PrivateMediaService } from '../private-media/private-media.service';

export type IdentityStatus = MobileIdentityVerification['status'];
const STATUSES: IdentityStatus[] = ['pending_review', 'approved', 'rejected'];
const SLOTS = {
  id_front: 'id_front_key',
  id_back: 'id_back_key',
  selfie: 'selfie_key',
} as const;
const SUMMARY_SELECT = {
  id: true,
  user_id: true,
  status: true,
  document_type: true,
  submitted_at: true,
  reviewed_at: true,
} as const;

function summary(row: MobileIdentityVerification, user?: MobileUser | null) {
  return {
    id: row.id,
    userId: row.user_id,
    ownerName: user?.name ?? null,
    ownerEmail: user?.email ?? null,
    documentType: row.document_type,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  };
}

@Injectable()
export class IdentityReviewService {
  constructor(
    private readonly db: DataSource,
    private readonly media: PrivateMediaService,
  ) {}

  async list(status = 'pending_review', page = 1) {
    if (!STATUSES.includes(status as IdentityStatus))
      throw new BadRequestException('Unknown verification status');
    if (!Number.isInteger(page) || page < 1 || page > 1000000)
      throw new BadRequestException('Invalid page');
    const [rows, total] = await this.db
      .getRepository(MobileIdentityVerification)
      .findAndCount({
        select: SUMMARY_SELECT,
        where: { status: status as IdentityStatus },
        order: { submitted_at: 'DESC', id: 'DESC' },
        take: 50,
        skip: (page - 1) * 50,
      });
    const users = rows.length
      ? await this.db.getRepository(MobileUser).find({
          select: { id: true, name: true, email: true },
          where: { id: In(rows.map((r) => r.user_id)) },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      verifications: rows.map((r) => summary(r, byId.get(r.user_id))),
      total,
      page,
      pageSize: 50,
    };
  }

  private async find(id: string) {
    const row = await this.db
      .getRepository(MobileIdentityVerification)
      .findOneBy({ id });
    if (!row) throw new NotFoundException('Identity verification not found');
    return row;
  }

  async detail(id: string) {
    const row = await this.find(id);
    const user = await this.db.getRepository(MobileUser).findOne({
      select: { id: true, name: true, email: true },
      where: { id: row.user_id },
    });
    return {
      verification: {
        ...summary(row, user),
        reviewNote: row.review_note,
        reviewedBy: row.reviewed_by,
        files: {
          id_front: !!row.id_front_key,
          id_back: !!row.id_back_key,
          selfie: !!row.selfie_key,
        },
      },
    };
  }

  async file(id: string, slot: string, actorId: string) {
    if (!Object.prototype.hasOwnProperty.call(SLOTS, slot))
      throw new NotFoundException('Image slot not found');
    const row = await this.find(id);
    const key = row[SLOTS[slot as keyof typeof SLOTS]];
    if (!key) throw new NotFoundException('Image not found');
    const file = await this.media.read(key);
    // Fail closed if the audit cannot be written. Keys and image bytes never enter it.
    await this.db.getRepository(AuditEvent).insert({
      actor_id: actorId,
      entity_type: 'mobile_identity',
      entity_id: id,
      action: 'mobile_identity.file_viewed',
      metadata: { slot },
    });
    return file;
  }

  async decide(id: string, actorId: string, approved: boolean, note?: unknown) {
    const trimmed = typeof note === 'string' ? note.trim() : '';
    if (!approved && (!trimmed || trimmed.length > 500))
      throw new BadRequestException(
        'A rejection needs a note of 1–500 characters',
      );
    // Lock the submission until decision, verified flag and audit all commit.
    return this.db.transaction(async (manager) => {
      const repo = manager.getRepository(MobileIdentityVerification);
      const row = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Identity verification not found');
      if (row.status !== 'pending_review')
        throw new ConflictException(
          'This submission has already been reviewed',
        );
      if (approved) {
        const updated = await manager
          .getRepository(MobileUser)
          .update({ id: row.user_id }, { is_verified: true });
        if (!updated.affected)
          throw new NotFoundException('User no longer exists');
      }
      row.status = approved ? 'approved' : 'rejected';
      row.review_note = approved ? null : trimmed;
      row.reviewed_by = actorId;
      row.reviewed_at = new Date();
      await repo.save(row);
      await manager.getRepository(AuditEvent).insert({
        actor_id: actorId,
        entity_type: 'mobile_identity',
        entity_id: id,
        action: approved
          ? 'mobile_identity.approved'
          : 'mobile_identity.rejected',
        metadata: { userId: row.user_id },
      });
      return {
        ok: true,
        id: row.id,
        status: row.status,
        reviewNote: row.review_note,
        reviewedAt: row.reviewed_at,
      };
    });
  }
}
