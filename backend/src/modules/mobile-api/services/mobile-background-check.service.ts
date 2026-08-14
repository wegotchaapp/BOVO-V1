import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import axios from 'axios';

import { MobileUser } from '../entities/mobile.entities';

/**
 * Background checks via Checkr.
 *
 * The Voyager enters their SSN and DOB in Checkr's own hosted invitation flow —
 * those values never touch a Bovogo server, request log, or database. We store
 * only the candidate handle, the report outcome, and the last four digits
 * Checkr echoes back for display.
 *
 * Deliberately absent: any field, parameter or log line carrying a full SSN.
 * Adding one would make Bovogo the custodian of record and pull it into GLBA
 * and state breach-notification regimes, for no product benefit.
 */

const CHECKR_TIMEOUT_MS = 10_000;

/** Checkr report status → our coarse status. */
function mapReportStatus(status: string): MobileUser['background_check_status'] {
  switch (status) {
    case 'clear':
      return 'clear';
    case 'consider':
    case 'dispute':
      return 'consider';
    case 'suspended':
      return 'suspended';
    default:
      return 'pending';
  }
}

@Injectable()
export class MobileBackgroundCheckService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly packageSlug: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
  ) {
    this.apiKey = this.config.get<string>('CHECKR_API_KEY') || '';
    this.apiUrl = this.config.get<string>('CHECKR_API_URL') || 'https://api.checkr.com';
    this.packageSlug =
      this.config.get<string>('CHECKR_PACKAGE') || 'driver_pro';
  }

  private get configured(): boolean {
    return !!this.apiKey && !this.apiKey.startsWith('your-');
  }

  private auth() {
    // Checkr uses HTTP Basic with the API key as the username, empty password.
    return { username: this.apiKey, password: '' };
  }

  /**
   * Creates (or reuses) a Checkr candidate and returns a hosted invitation URL.
   * The Voyager completes SSN entry and consent inside Checkr.
   */
  async startCheck(user: MobileUser) {
    if (!this.configured) {
      throw new BadRequestException(
        'Background checks are not configured yet. Please try again once Bovogo has finished setup.',
      );
    }
    if (user.background_check_status === 'clear') {
      return { alreadyCleared: true, invitationUrl: null, status: 'clear' as const };
    }

    try {
      let candidateId = user.checkr_candidate_id;

      if (!candidateId) {
        const [firstName, ...rest] = user.name.trim().split(/\s+/);
        const res = await axios.post(
          `${this.apiUrl}/v1/candidates`,
          {
            first_name: firstName || user.name,
            last_name: rest.join(' ') || firstName || user.name,
            email: user.email,
            phone: user.phone || undefined,
            work_locations: [{ country: 'US', state: 'TX' }],
            // No SSN here — Checkr collects it directly from the candidate.
          },
          { auth: this.auth(), timeout: CHECKR_TIMEOUT_MS },
        );
        candidateId = res.data?.id;
        if (!candidateId) {
          throw new Error('Checkr did not return a candidate id');
        }
      }

      const invitation = await axios.post(
        `${this.apiUrl}/v1/invitations`,
        { candidate_id: candidateId, package: this.packageSlug },
        { auth: this.auth(), timeout: CHECKR_TIMEOUT_MS },
      );

      user.checkr_candidate_id = candidateId;
      user.background_check_status = 'invitation_sent';
      await this.users.save(user);

      return {
        alreadyCleared: false,
        invitationUrl: invitation.data?.invitation_url ?? null,
        status: user.background_check_status,
      };
    } catch (err: any) {
      this.logger.error(
        { err: err?.message, userId: user.id },
        'Checkr invitation failed',
      );
      throw new BadRequestException(
        "We couldn't start your background check just now. Please try again in a few minutes.",
      );
    }
  }

  /** Current status, refreshed from Checkr when a candidate exists. */
  async status(user: MobileUser) {
    if (!this.configured || !user.checkr_candidate_id) {
      return this.toDto(user);
    }

    try {
      const res = await axios.get(
        `${this.apiUrl}/v1/candidates/${user.checkr_candidate_id}/reports`,
        { auth: this.auth(), timeout: CHECKR_TIMEOUT_MS },
      );
      const report = res.data?.data?.[0];
      if (report?.status) {
        const next = mapReportStatus(report.status);
        if (next !== user.background_check_status) {
          user.background_check_status = next;
          if (next === 'clear' || next === 'consider') {
            user.background_check_completed_at = new Date();
            user.ssn_verified = next === 'clear';
          }
          await this.users.save(user);
        }
      }
    } catch (err: any) {
      // A status refresh must never break the screen — fall back to stored.
      this.logger.warn(
        { err: err?.message, userId: user.id },
        'Checkr status refresh failed; serving stored status',
      );
    }

    return this.toDto(user);
  }

  /**
   * Checkr webhook. Updates the stored outcome and records the last four SSN
   * digits Checkr echoes back — never the full number.
   */
  async handleWebhook(payload: {
    type?: string;
    data?: { object?: { candidate_id?: string; status?: string; ssn?: string } };
  }) {
    const object = payload?.data?.object;
    const candidateId = object?.candidate_id;
    if (!candidateId) return { ok: true, ignored: 'no candidate_id' };

    const user = await this.users.findOne({
      where: { checkr_candidate_id: candidateId },
    });
    if (!user) {
      this.logger.warn({ candidateId }, 'Checkr webhook for unknown candidate');
      return { ok: true, ignored: 'unknown candidate' };
    }

    if (object.status) {
      user.background_check_status = mapReportStatus(object.status);
      if (user.background_check_status === 'clear') {
        user.ssn_verified = true;
      }
      if (['clear', 'consider', 'suspended'].includes(user.background_check_status)) {
        user.background_check_completed_at = new Date();
      }
    }

    // Checkr sends a masked SSN like "XXX-XX-6741". Keep only the four digits.
    if (typeof object.ssn === 'string') {
      const last4 = object.ssn.replace(/\D/g, '').slice(-4);
      if (last4.length === 4) user.ssn_last4 = last4;
    }

    await this.users.save(user);
    return { ok: true };
  }

  private toDto(user: MobileUser) {
    return {
      status: user.background_check_status,
      ssnVerified: user.ssn_verified,
      ssnLast4: user.ssn_last4,
      completedAt: user.background_check_completed_at?.toISOString() ?? null,
      configured: this.configured,
    };
  }
}
