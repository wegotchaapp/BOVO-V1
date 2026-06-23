import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, MoreThanOrEqual, Repository } from 'typeorm';
import { MobileDriverTrip } from '../entities/mobile.entities';
import { driverTripToDto } from '../mobile.mappers';

/**
 * Returns the UTC instant for the first moment of the current month in Texas
 * (America/Chicago) — Bovogo is a Texas-only service, so the calendar boundary
 * is pinned to Central Time regardless of server locale.
 */
function startOfCurrentMonthCentralAsUtc(): Date {
  const TZ = 'America/Chicago';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const year = get('year');
  const month = get('month');
  for (const offsetHours of [5, 6]) {
    const candidate = new Date(Date.UTC(year, month - 1, 1, offsetHours, 0, 0, 0));
    const proj = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(candidate);
    const pget = (t: string) => Number(proj.find((p) => p.type === t)!.value);
    if (
      pget('year') === year &&
      pget('month') === month &&
      pget('day') === 1 &&
      pget('hour') === 0 &&
      pget('minute') === 0
    ) {
      return candidate;
    }
  }
  return new Date(Date.UTC(year, month - 1, 1));
}

@Injectable()
export class MobileEarningsService {
  constructor(
    @InjectRepository(MobileDriverTrip)
    private readonly driverTrips: Repository<MobileDriverTrip>,
  ) {}

  async summary(driverId: string, period: string) {
    if (period !== 'month' && period !== 'all') {
      throw new BadRequestException('Invalid period');
    }

    const where: FindOptionsWhere<MobileDriverTrip> = { driver_id: driverId };
    if (period === 'month') {
      where.completed_at = MoreThanOrEqual(startOfCurrentMonthCentralAsUtc());
    }

    const rows = await this.driverTrips.find({
      where,
      order: { completed_at: 'DESC' },
    });

    const trips = rows.map(driverTripToDto);
    return {
      period,
      tripCount: trips.length,
      totalMiles: trips.reduce((s, t) => s + t.miles, 0),
      grossTotal: trips.reduce((s, t) => s + t.grossAmount, 0),
      platformFeeTotal: trips.reduce((s, t) => s + t.platformFee, 0),
      netTotal: trips.reduce((s, t) => s + t.netAmount, 0),
      trips,
    };
  }
}
