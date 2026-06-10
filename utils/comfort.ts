/**
 * Universal Comfort Index.
 *
 * A 0-100 score of how *physically comfortable* a place is for anyone — not
 * just disabled visitors. Built from four factors:
 *   - parking   : how easy it is to park
 *   - walking   : how little walking is needed inside (higher = less walking)
 *   - seating   : availability of places to sit
 *   - calm      : low crowd + low noise (from the crowd estimate)
 *
 * Heuristic from category + the vision agent's signals + the crowd estimate.
 * Benefits seniors, parents with strollers, anyone tired — and PWD users.
 */

import { estimateCrowd } from './crowd';
import type { AIAnalysis } from '../types';

export interface ComfortFactors {
  parking: number;
  walking: number;
  seating: number;
  calm: number;
}

export interface ComfortIndex {
  /** Overall 0-100. */
  score: number;
  factors: ComfortFactors;
  label: string;
}

export interface ComfortInput {
  category: string;
  totalReviews: number;
  aiAnalysis: AIAnalysis | null;
}

const clamp = (n: number) => Math.max(5, Math.min(100, Math.round(n)));

export function comfortIndex(input: ComfortInput): ComfortIndex {
  const c = input.category.toLowerCase();
  const ai = input.aiAnalysis;

  const parking = ai?.hasAccessibleParking
    ? 92
    : /(mall|airport|cinema|movie|amusement|shopping|supermarket|hotel)/.test(c)
      ? 80
      : /(restaurant|cafe|bar|bakery)/.test(c)
        ? 55
        : /(park|monument|tourist|temple|fort|museum)/.test(c)
          ? 45
          : 55;

  // Higher = LESS walking needed inside.
  const walking = /(cafe|bakery|restaurant|bar|cinema|movie)/.test(c)
    ? 85
    : /(mall|shopping|supermarket|museum|gallery|library)/.test(c)
      ? 62
      : /(park|garden|monument|tourist|fort|zoo|lake|trek)/.test(c)
        ? 35
        : 58;

  const seating = /(cafe|restaurant|bar|bakery|cinema|movie|library)/.test(c)
    ? 90
    : /(mall|museum|gallery|airport)/.test(c)
      ? 70
      : /(park|garden)/.test(c)
        ? 48
        : /(monument|tourist|fort|market)/.test(c)
          ? 35
          : 60;

  // Calm from the live crowd estimate.
  const crowd = estimateCrowd(input);
  let calm = 100 - crowd.busyness;
  if (crowd.noise === 'high') calm -= 15;
  else if (crowd.noise === 'low') calm += 8;
  calm = clamp(calm);

  const factors: ComfortFactors = {
    parking: clamp(parking),
    walking: clamp(walking),
    seating: clamp(seating),
    calm,
  };
  const score = clamp((factors.parking + factors.walking + factors.seating + factors.calm) / 4);

  const label =
    score >= 75 ? 'Very comfortable' : score >= 58 ? 'Comfortable' : score >= 42 ? 'Moderate effort' : 'High effort';

  return { score, factors, label };
}
