export type WeatherState =
  | "sunny"
  | "partly-cloudy"
  | "cloudy"
  | "rain"
  | "thunderstorm"
  | "fog"
  | "snow"
  | "night";

/** How often components should re-poll (matches cache TTL). */
export const WEATHER_POLL_MS = 2 * 60 * 1000; // 2 minutes

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  "Austin, TX":         { lat: 30.2672,  lon: -97.7431  },
  "Houston, TX":        { lat: 29.7604,  lon: -95.3698  },
  "Dallas, TX":         { lat: 32.7767,  lon: -96.797   },
  "Bentonville, AR":    { lat: 36.3729,  lon: -94.2088  },
  "San Antonio, TX":    { lat: 29.4241,  lon: -98.4936  },
  "Fort Worth, TX":     { lat: 32.7555,  lon: -97.3308  },
  "El Paso, TX":        { lat: 31.7619,  lon: -106.485  },
  "Arlington, TX":      { lat: 32.7357,  lon: -97.1081  },
  "Plano, TX":          { lat: 33.0198,  lon: -96.6989  },
  "Lubbock, TX":        { lat: 33.5779,  lon: -101.8552 },
  "Corpus Christi, TX": { lat: 27.8006,  lon: -97.3964  },
  "Waco, TX":           { lat: 31.5493,  lon: -97.1467  },
  "Amarillo, TX":       { lat: 35.222,   lon: -101.8313 },
};

function codeToState(code: number, isDay: boolean, cloudCover: number): WeatherState {
  if (!isDay) return "night";

  if (code >= 95)                  return "thunderstorm";
  if (code >= 85 && code <= 86)   return "snow";
  if (code >= 80 && code <= 82)   return "rain";
  if (code >= 71 && code <= 77)   return "snow";
  if (code >= 51 && code <= 67)   return "rain";
  if (code === 45 || code === 48) return "fog";

  // Cloud cover overrides — conservative thresholds because models under-report
  if (cloudCover >= 65) return "cloudy";
  if (cloudCover >= 28) return "partly-cloudy";

  if (code === 3) return "cloudy";
  if (code === 2) return "partly-cloudy";
  return "sunny";
}

/**
 * Determine daytime accurately from actual sunrise/sunset timestamps.
 *
 * Open-Meteo returns sunrise/sunset as LOCAL time strings with NO timezone
 * suffix (e.g. "2026-06-01T06:29"). JavaScript's Date parser treats these as
 * LOCAL device time, which is wrong when the user's device is in a different
 * timezone from the destination city.
 *
 * Fix: append "Z" so JS parses the string as UTC, then subtract the location's
 * UTC offset to get the true UTC epoch of that local time:
 *   utcMs = new Date(localString + "Z").getTime() - utcOffsetSeconds * 1000
 */
function computeIsDay(
  sunriseLocal: string,
  sunsetLocal: string,
  utcOffsetSeconds: number,
): boolean {
  const offsetMs     = utcOffsetSeconds * 1000;
  const sunriseUtcMs = new Date(sunriseLocal + "Z").getTime() - offsetMs;
  const sunsetUtcMs  = new Date(sunsetLocal  + "Z").getTime() - offsetMs;
  return Date.now() >= sunriseUtcMs && Date.now() <= sunsetUtcMs;
}

// ── Cache ──────────────────────────────────────────────────────────────────────
const _cache = new Map<string, { state: WeatherState; ts: number }>();

export async function fetchCityWeather(city: string): Promise<WeatherState> {
  const hit = _cache.get(city);
  if (hit && Date.now() - hit.ts < WEATHER_POLL_MS) return hit.state;

  const coords = CITY_COORDS[city];
  if (!coords) return "sunny";

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${coords.lat}&longitude=${coords.lon}` +
      `&current=weather_code,is_day,cloud_cover` +
      `&daily=sunrise,sunset` +
      `&timezone=auto` +
      `&forecast_days=1`,
    );
    if (!res.ok) return _cache.get(city)?.state ?? "sunny";

    const data  = await res.json();
    const { weather_code, cloud_cover } = data.current;
    const isDay = computeIsDay(
      data.daily.sunrise[0],
      data.daily.sunset[0],
      data.utc_offset_seconds ?? 0,
    );
    const state = codeToState(weather_code, isDay, cloud_cover ?? 0);
    _cache.set(city, { state, ts: Date.now() });
    return state;
  } catch {
    // On error return stale cache if available, otherwise default
    return _cache.get(city)?.state ?? "sunny";
  }
}
