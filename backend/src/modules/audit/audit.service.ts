import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from '../../database/entities/audit.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditRepo: Repository<AuditEvent>,
  ) {}

  async log(data: {
    actor_id: string | null;
    entity_type: string;
    entity_id: string | undefined;
    event_type: string;
    payload: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditEvent> {
    const event = this.auditRepo.create({
      actor_id: data.actor_id,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      action: data.event_type,
      metadata: data.payload,
      ip_address: data.ip_address || null,
    });

    return this.auditRepo.save(event);
  }

  async getAuditTrail(
    entityType: string,
    entityId: string,
  ): Promise<AuditEvent[]> {
    return this.auditRepo.find({
      where: { entity_type: entityType, entity_id: entityId },
      order: { created_at: 'ASC' },
    });
  }

  async getAuditEvents(params: {
    actorId?: string;
    entityType?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ events: AuditEvent[]; total: number }> {
    const qb = this.auditRepo.createQueryBuilder('audit');

    if (params.actorId) {
      qb.andWhere('audit.actor_id = :actorId', { actorId: params.actorId });
    }
    if (params.entityType) {
      qb.andWhere('audit.entity_type = :entityType', {
        entityType: params.entityType,
      });
    }
    if (params.eventType) {
      qb.andWhere('audit.action = :eventType', { eventType: params.eventType });
    }
    if (params.startDate) {
      qb.andWhere('audit.created_at >= :startDate', {
        startDate: params.startDate,
      });
    }
    if (params.endDate) {
      qb.andWhere('audit.created_at <= :endDate', { endDate: params.endDate });
    }

    qb.orderBy('audit.created_at', 'DESC');

    const page = params.page || 1;
    const limit = params.limit || 50;
    qb.skip((page - 1) * limit).take(limit);

    const [events, total] = await qb.getManyAndCount();

    return { events, total };
  }

  async getEventById(id: string): Promise<AuditEvent | null> {
    return this.auditRepo.findOne({ where: { id } });
  }

  async deleteEvent(_id: string): Promise<never> {
    throw new ForbiddenException(
      'Audit events are immutable and cannot be deleted',
    );
  }

  async updateEvent(_id: string, _data: Partial<AuditEvent>): Promise<never> {
    throw new ForbiddenException(
      'Audit events are immutable and cannot be updated',
    );
  }
}
