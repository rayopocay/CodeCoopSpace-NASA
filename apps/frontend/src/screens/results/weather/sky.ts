/**
 * How the weather view looks and talks: time of day in El Salvador, the sky
 * colours and the everyday words that sum up the forecast.
 *
 * The words are Yago's way of putting the figures in plain language. Their
 * thresholds are a description choice, not an official classification, and
 * the screen says so next to the sources.
 */
import type { CurrentWeather, WeatherPoint } from '../../../api/types';

export const TIME_ZONE = 'America/El_Salvador';

export type DayPeriod = 'dawn' | 'day' | 'dusk' | 'night';
export type Sky = DayPeriod | 'rain';
export type Condition = 'downpour' | 'rain' | 'drizzle' | 'scorching' | 'hot' | 'mild' | 'cool';

/** Rain in the next 6 hours, mm. */
const DOWNPOUR_MM = 10;
const RAIN_MM = 2;
const DRIZZLE_MM = 0.2;
/** Temperature, °C. */
const SCORCHING_C = 33;
const HOT_C = 28;
const MILD_C = 22;

/** Same threshold as the server (services/api/app/power.py): a dry spell is 5 or more days in a row. */
export const DRY_SPELL_DAYS = 5;

const hourFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: TIME_ZONE });

/** Hour of the day (0–23) in El Salvador. */
export function hourInElSalvador(value: string | Date): number {
  return Number(hourFormatter.format(typeof value === 'string' ? new Date(value) : value)) % 24;
}

export function dayPeriod(hour: number): DayPeriod {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'dusk';
  return 'night';
}

/** Three colour stops, top to bottom. Ink, leaf and maize, mixed for each moment of the day. */
export const SKY_COLORS: Record<Sky, [string, string, string]> = {
  dawn: ['#20262A', '#8A5A2B', '#F3B72B'],
  day: ['#0F4A2C', '#17603B', '#C99A2A'],
  dusk: ['#171A16', '#5B3A1C', '#E39A2A'],
  night: ['#0B0E0C', '#171A16', '#1E3D2B'],
  rain: ['#1B211E', '#33433A', '#6E7F74'],
};

export function rainNext6h(weather: CurrentWeather | null): number | null {
  return weather?.forecast[0]?.rainMm ?? null;
}

export function skyFor(period: DayPeriod, rain6h: number | null): Sky {
  return rain6h !== null && rain6h >= RAIN_MM ? 'rain' : period;
}

export function describe(temperature: number | null, rain6h: number | null): Condition | null {
  if (rain6h !== null && rain6h >= DOWNPOUR_MM) return 'downpour';
  if (rain6h !== null && rain6h >= RAIN_MM) return 'rain';
  if (rain6h !== null && rain6h >= DRIZZLE_MM) return 'drizzle';
  if (temperature === null) return null;
  if (temperature >= SCORCHING_C) return 'scorching';
  if (temperature >= HOT_C) return 'hot';
  if (temperature >= MILD_C) return 'mild';
  return 'cool';
}

/** Glyph for one forecast moment. */
export function glyphFor(point: WeatherPoint): 'sun' | 'moon' | 'rain' | 'drizzle' {
  if (point.rainMm !== null && point.rainMm >= RAIN_MM) return 'rain';
  if (point.rainMm !== null && point.rainMm >= DRIZZLE_MM) return 'drizzle';
  return dayPeriod(hourInElSalvador(point.validAt)) === 'night' ? 'moon' : 'sun';
}

/** Lowest and highest temperature among now and the next 24 hours. */
export function temperatureRange(weather: CurrentWeather | null): { min: number; max: number } | null {
  if (!weather) return null;
  const values = [weather.current, ...weather.forecast].flatMap((point) => (point?.temperatureC != null ? [point.temperatureC] : []));
  if (values.length === 0) return null;
  return { min: Math.round(Math.min(...values)), max: Math.round(Math.max(...values)) };
}

/** Rain expected in the next 24 hours: the four 6-hour totals added up. null if none has a value. */
export function rainNext24h(weather: CurrentWeather | null): number | null {
  const values = (weather?.forecast ?? []).flatMap((point) => (point.rainMm != null ? [point.rainMm] : []));
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 10) / 10;
}
