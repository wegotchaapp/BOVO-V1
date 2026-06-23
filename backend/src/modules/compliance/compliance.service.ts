import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ComplianceLog } from '../../database/entities/compliance-log.entity';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class ComplianceService {
  constructor(
    @InjectRepository(ComplianceLog)
    private readonly complianceRepo: Repository<ComplianceLog>,
    private readonly logger: PinoLogger,
  ) {}

  async log(userId: string, rule: string, action: string, details?: string): Promise<ComplianceLog> {
    const entry = this.complianceRepo.create({
      id: uuidv4().replace(/-/g, '').slice(0, 32),
      user_id: userId,
      rule,
      action,
      details: details || null,
      triggered_at: new Date(),
    });
    const saved = await this.complianceRepo.save(entry);
    this.logger.info({ userId, rule, action }, 'Compliance log entry created');
    return saved;
  }

  async getLogs(userId: string, limit?: number): Promise<ComplianceLog[]> {
    return this.complianceRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit || 50,
    });
  }

  async getLogsByRule(rule: string, limit?: number): Promise<ComplianceLog[]> {
    return this.complianceRepo.find({
      where: { rule },
      order: { created_at: 'DESC' },
      take: limit || 50,
    });
  }
}
