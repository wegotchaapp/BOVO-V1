import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const WMO_STATES: Record<number, string> = {
  0: 'clear',
  1: 'partly_cloudy',
  2: 'partly_cloudy',
  3: 'cloudy',
  45: 'cloudy',
  48: 'cloudy',
  51: 'rainy',
  53: 'rainy',
  55: 'rainy',
  61: 'rainy',
  63: 'rainy',
  65: 'rainy',
  71: 'snowy',
  73: 'snowy',
  75: 'snowy',
  80: 'rainy',
  81: 'rainy',
  82: 'rainy',
  95: 'stormy',
  96: 'stormy',
  99: 'stormy',
};

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private cache: { data: any; timestamp: number } | null = null;
  private readonly CACHE_TTL = 30 * 60 * 1000;

  async getCurrentWeather(lat = 30.2672, lon = -97.7431) {
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    try {
      const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: lat,
          longitude: lon,
          current_weather: true,
          timezone: 'America/Chicago',
        },
        timeout: 5000,
      });

      const cw = res.data.current_weather;
      const rawCondition = WMO_STATES[cw.weathercode] || 'clear';
      const hour = new Date(cw.time).getHours();
      const isDay = hour >= 6 && hour < 20;
      const condition = isDay ? rawCondition : 'night';

      const data = {
        temperature: Math.round((cw.temperature * 9) / 5 + 32),
        condition,
        weather_code: cw.weathercode,
        is_day: isDay,
        location: 'Austin, TX',
        cached_at: new Date().toISOString(),
      };

      this.cache = { data, timestamp: Date.now() };
      return data;
    } catch (err) {
      this.logger.warn(
        'Weather fetch failed, returning cached or fallback',
        err,
      );
      if (this.cache) return this.cache.data;
      return {
        temperature: 72,
        condition: 'clear',
        weather_code: 0,
        is_day: true,
        location: 'Austin, TX',
      };
    }
  }
}
