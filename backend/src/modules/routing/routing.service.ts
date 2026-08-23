import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import axios from 'axios';

import { cityCoordinates } from '../../common/geo/texas-cities';
import { decodePolyline, type LatLng } from '../../common/geo/route-geometry';

const DIRECTIONS_TIMEOUT_MS = 6_000;

/** Mapbox's default `geometries=polyline` encoding. */
const POLYLINE_PRECISION = 5;

/**
 * Fetches driving routes from Mapbox Directions.
 *
 * Kept apart from deviation detection deliberately: the route is fetched once
 * per adventure and then reused for every location ping, so the maths that runs
 * on each ping does no I/O at all.
 */
@Injectable()
export class RoutingService {
  private readonly accessToken: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.accessToken = this.config.get<string>('MAPBOX_ACCESS_TOKEN') || '';
  }

  get configured(): boolean {
    return Boolean(this.accessToken);
  }

  /**
   * Encoded driving polyline between two of the app's cities, or null.
   *
   * Never throws — a missing route degrades deviation detection to "cannot
   * tell", which is the honest outcome, rather than failing a location ping.
   */
  async routeBetweenCities(fromCity: string, toCity: string): Promise<string | null> {
    if (!this.accessToken) {
      this.logger.warn('MAPBOX_ACCESS_TOKEN is not set — no route geometry, so no deviation detection.');
      return null;
    }

    const from = cityCoordinates(fromCity);
    const to = cityCoordinates(toCity);
    if (!from || !to) {
      this.logger.warn(
        { fromCity, toCity, fromKnown: Boolean(from), toKnown: Boolean(to) },
        'Route skipped — city not in the coordinate table',
      );
      return null;
    }

    try {
      const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
        `?access_token=${this.accessToken}&overview=full&geometries=polyline`;
      const { data } = await axios.get(url, { timeout: DIRECTIONS_TIMEOUT_MS });

      const geometry: string | undefined = data?.routes?.[0]?.geometry;
      if (!geometry) {
        this.logger.warn({ fromCity, toCity, code: data?.code }, 'Mapbox returned no route');
        return null;
      }
      return geometry;
    } catch (err) {
      // Never log the error object: axios errors carry config.headers, and the
      // access token rides in the URL too.
      const res = (err as any)?.response;
      this.logger.error(
        { status: res?.status ?? null, code: res?.data?.code ?? null, fromCity, toCity },
        'Mapbox Directions request failed',
      );
      return null;
    }
  }

  /** Decodes what `routeBetweenCities` returns. */
  decode(encoded: string): LatLng[] {
    return decodePolyline(encoded, POLYLINE_PRECISION);
  }
}
