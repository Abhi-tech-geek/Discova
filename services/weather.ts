/**
 * Weather service — Open-Meteo (free, no API key required).
 * Used for weather-aware suggestions ("rainy → indoor accessible cafés").
 * Every call is wrapped in try/catch and returns `null` on failure.
 */

import type { GeoPoint } from '../types';

export interface Weather {
  /** Current temperature, °C (rounded). */
  tempC: number;
  isRaining: boolean;
  isHot: boolean;
  /** Short human condition, e.g. "Light rain". */
  condition: string;
  /** True when staying indoors is the comfortable choice. */
  suggestIndoor: boolean;
}

/** WMO weather-code → short label. */
function describeCode(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

/**
 * Fetch current weather for a coordinate.
 * @returns `null` if the request fails.
 */
export async function getWeather(point: GeoPoint): Promise<Weather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${point.latitude}` +
      `&longitude=${point.longitude}&current=temperature_2m,precipitation,weather_code`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; precipitation?: number; weather_code?: number };
    };
    const cur = data.current;
    if (!cur) return null;

    const temp = cur.temperature_2m ?? 0;
    const precip = cur.precipitation ?? 0;
    const code = cur.weather_code ?? 0;
    const isRaining = precip > 0 || (code >= 51 && code <= 99 && code !== 71 && code !== 73 && code !== 75);
    const isHot = temp >= 35;

    return {
      tempC: Math.round(temp),
      isRaining,
      isHot,
      condition: describeCode(code),
      suggestIndoor: isRaining || isHot,
    };
  } catch {
    return null;
  }
}
