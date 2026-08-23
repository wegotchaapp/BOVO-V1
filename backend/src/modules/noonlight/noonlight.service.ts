import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import axios from 'axios';

const NOONLIGHT_TIMEOUT_MS = 5_000;

/**
 * Metres of GPS uncertainty reported when the client did not send its own.
 * `accuracy` is required on the coordinates object, and inventing a tight figure
 * would tell a dispatcher we are more certain of the location than we are, so
 * this is deliberately loose. Pass the device's real accuracy when there is one.
 */
export const DEFAULT_LOCATION_ACCURACY_M = 50;

/**
 * Noonlight rejects a leading "+" outright — "phone should be a supported phone
 * format" — and wants bare digits with the country code. Verified against the
 * sandbox API: `+15550000000` is a 400, `15550000000` is a 201.
 */
export function toNoonlightPhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  // Bovogo is a Texas-only service, so a bare 10-digit number is a US number
  // that simply has no country code on it.
  return digits.length === 10 ? `1${digits}` : digits;
}

export interface NoonlightAlarmInput {
  name: string;
  phone: string | null | undefined;
  lat: number;
  lng: number;
  accuracyMeters?: number;
  instructions: string;
}

/**
 * Opens alarms with Noonlight's Dispatch API.
 *
 * Shared by the platform and mobile SOS paths, which keep their own records in
 * their own tables but must dispatch identically. Never throws: a failure here
 * has to leave the caller free to carry on with local escalation.
 */
@Injectable()
export class NoonlightService {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.apiUrl =
      this.config.get<string>('NOONLIGHT_API_URL') || 'https://api-sandbox.noonlight.com';
    this.apiKey = this.config.get<string>('NOONLIGHT_API_KEY') || '';
  }

  /** Returns the Noonlight alarm id, or null when unconfigured or rejected. */
  async createAlarm(input: NoonlightAlarmInput): Promise<string | null> {
    if (!this.apiKey) {
      this.logger.warn(
        'NOONLIGHT_API_KEY is not set — SOS will escalate locally only, with no professional dispatch.',
      );
      return null;
    }

    const phone = toNoonlightPhone(input.phone);
    if (phone.length < 11) {
      this.logger.error(
        { digits: phone.length },
        'Noonlight dispatch skipped — no usable phone number on file, which Noonlight requires to open an alarm.',
      );
      return null;
    }

    try {
      const res = await axios.post(
        `${this.apiUrl}/dispatch/v1/alarms`,
        {
          name: input.name,
          phone,
          // Noonlight's schema takes either `coordinates` or `address` and
          // rejects anything else ("location should not have additional
          // properties"). `accuracy` is required.
          location: {
            coordinates: {
              lat: input.lat,
              lng: input.lng,
              accuracy: input.accuracyMeters ?? DEFAULT_LOCATION_ACCURACY_M,
            },
          },
          instructions: { entry: input.instructions },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: NOONLIGHT_TIMEOUT_MS,
        },
      );

      const alarmId: string | null = res.data?.id ?? null;
      this.logger.info({ alarmId }, 'Noonlight alarm created');
      return alarmId;
    } catch (err) {
      // Never log the error object itself: an axios error carries `config`, and
      // `config.headers.Authorization` is the Noonlight API key.
      const res = (err as any)?.response;
      this.logger.error(
        {
          status: res?.status ?? null,
          key: res?.data?.key ?? null,
          details: res?.data?.details ?? null,
          noonlightMessage: res?.data?.message ?? null,
          message: (err as any)?.message ?? null,
        },
        'Noonlight dispatch failed — continuing with local SOS escalation',
      );
      return null;
    }
  }
}
