/**
 * Crowd / quiet estimator.
 *
 * Google's official Places API does NOT expose live "popular times", so this
 * produces an honest *estimate* of how busy/noisy a place is right now from:
 *   1. time-of-day + weekday vs weekend, against typical peak windows per
 *      category (a café peaks at lunch/dinner; a park in the early morning),
 *   2. popularity (very-reviewed places skew busier),
 *   3. the vision agent's `crowdLevel` / `noiseLevel` when the place has been
 *      AI-analysed (a strong, real signal that overrides the time heuristic).
 *
 * Useful for sensory-sensitive users (avoid overwhelming places) and everyone
 * (skip the queue / find a calm spot).
 */

import type { AIAnalysis, IntensityLevel } from '../types';

export type CrowdLevel = 'quiet' | 'moderate' | 'busy';

export interface CrowdEstimate {
  crowd: CrowdLevel;
  noise: IntensityLevel;
  /** 0-100 busyness for the meter bar. */
  busyness: number;
  /** Short human label, e.g. "Usually quiet now". */
  label: string;
  /** True when a real AI/photo signal contributed (vs a pure time guess). */
  hasSignal: boolean;
}

/** Minimal shape needed to estimate crowd for a place. */
export interface CrowdInput {
  category: string;
  totalReviews: number;
  aiAnalysis: AIAnalysis | null;
}

/** Typical busy windows [startHour, endHour) per coarse category. */
function categoryPeaks(category: string): Array<[number, number]> {
  const c = category.toLowerCase();
  // Amusement / theme parks + resorts open late morning — match BEFORE "park".
  if (/(amusement|theme park|water park|trampoline|adventure|resort|farm)/.test(c)) return [[12, 19]];
  if (/(restaurant|cafe|bakery|food|bar|pub|night|diner)/.test(c)) return [[12, 14], [19, 22]];
  if (/(mall|shopping|store|market|supermarket)/.test(c)) return [[17, 21]];
  if (/(museum|gallery|monument|tourist|temple|attraction|church|fort)/.test(c)) return [[11, 17]];
  if (/(park|garden|zoo|lake)/.test(c)) return [[8, 10], [17, 20]];
  if (/(gym|fitness)/.test(c)) return [[6, 9], [18, 21]];
  if (/(airport|station|transit)/.test(c)) return [[7, 10], [17, 21]];
  return [[12, 14], [18, 20]];
}

/** Infer a noise level from category when no AI signal is available. */
function noiseFromCategory(category: string): IntensityLevel {
  const c = category.toLowerCase();
  if (/(bar|pub|night|mall|market|airport|station|amusement|club)/.test(c)) return 'high';
  if (/(park|garden|library|museum|temple|spa|gallery|book)/.test(c)) return 'low';
  return 'medium';
}

/**
 * Estimate how busy / noisy a place is at `now` (defaults to current time).
 */
export function estimateCrowd(place: CrowdInput, now: Date = new Date()): CrowdEstimate {
  const hour = now.getHours();
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const peaks = categoryPeaks(place.category);
  const peak = peaks.some(([a, b]) => hour >= a && hour < b);

  // Base busyness from time.
  let busyness = peak ? 70 : 35;
  if (weekend && peak) busyness += 12;
  if (hour < 7 || hour >= 23) busyness = 12; // off-hours

  // Popularity nudge.
  const reviews = place.totalReviews || 0;
  if (reviews > 2000) busyness += 10;
  else if (reviews > 500) busyness += 5;

  // Strong AI photo signal, if the place was analysed.
  const ai = place.aiAnalysis;
  const hasSignal = ai !== null;
  if (ai) {
    const map: Record<IntensityLevel, number> = { low: 20, medium: 55, high: 85 };
    busyness = Math.round(busyness * 0.5 + map[ai.crowdLevel] * 0.5);
  }
  busyness = Math.max(5, Math.min(100, busyness));

  const crowd: CrowdLevel = busyness >= 66 ? 'busy' : busyness >= 38 ? 'moderate' : 'quiet';
  const noise: IntensityLevel = ai ? ai.noiseLevel : noiseFromCategory(place.category);

  // Honest "typical" framing — Google doesn't expose real-time popularity.
  const label =
    crowd === 'busy' ? 'Usually busy' : crowd === 'quiet' ? 'Usually quiet' : 'Moderately busy';

  return { crowd, noise, busyness, label, hasSignal };
}

export interface DayBusyness {
  /** Busyness 0-100 for each hour 8 AM … 9 PM. */
  hours: Array<{ hour: number; level: number }>;
  /** The quietest 2-hour window. */
  quietest: { startHour: number; label: string };
}

/** Format an hour (0-23) as "3 PM". */
function formatHour(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12} ${ampm}`;
}

/**
 * Typical busyness across the day for a category (time heuristic only — used by
 * the "Best time to visit" widget). Returns hourly levels + the quietest window.
 */
export function dayBusyness(category: string): DayBusyness {
  const peaks = categoryPeaks(category);
  const isPeak = (h: number) => peaks.some(([a, b]) => h >= a && h < b);

  const hours: Array<{ hour: number; level: number }> = [];
  for (let h = 8; h <= 21; h++) {
    const level = isPeak(h) ? 80 : h < 10 || h > 20 ? 28 : 48;
    hours.push({ hour: h, level });
  }

  let best = { start: hours[0].hour, sum: Infinity };
  for (let i = 0; i < hours.length - 1; i++) {
    const sum = hours[i].level + hours[i + 1].level;
    if (sum < best.sum) best = { start: hours[i].hour, sum };
  }

  return {
    hours,
    quietest: { startHour: best.start, label: `${formatHour(best.start)}–${formatHour(best.start + 2)}` },
  };
}
