/**
 * Scoring Agent.
 * Pure-TypeScript scoring math — no AI calls. Combines a set of vision analyses
 * for one place into a fresh `AccessibilityScores` block (weighted by recency)
 * and persists it via the firebase service.
 */

import { updatePlaceScores } from '../firebase';
import type { AIAnalysis, AccessibilityScores, IntensityLevel } from '../../types';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*  Weighting                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Return the recency weight for an analysis timestamp.
 * Analyses from the last 7 days get weight 1.0; older ones get 0.5.
 * @param timestamp Epoch ms when the analysis was produced.
 * @param now Epoch ms of "now" (overridable for tests).
 */
export function getRecencyWeight(timestamp: number, now: number = Date.now()): number {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0.5;
  return now - timestamp <= ONE_WEEK_MS ? 1.0 : 0.5;
}

/** A single value paired with its weight for `weightedAverage`. */
export interface WeightedValue {
  value: number;
  weight: number;
}

/**
 * Compute the weighted arithmetic mean of a list of {value, weight} pairs.
 * Returns 0 for an empty list or when total weight is zero.
 */
export function weightedAverage(values: WeightedValue[]): number {
  if (values.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const { value, weight } of values) {
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) continue;
    weightedSum += value * weight;
    totalWeight += weight;
  }
  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}

/* -------------------------------------------------------------------------- */
/*  Per-category extractors                                                   */
/* -------------------------------------------------------------------------- */

/** Map an IntensityLevel to a friendliness score (lower intensity = friendlier). */
function intensityFriendliness(level: IntensityLevel): number {
  if (level === 'low') return 100;
  if (level === 'medium') return 60;
  return 20;
}

/** Hearing-accessibility heuristic from one analysis (0-100). */
function hearingScore(a: AIAnalysis): number {
  let score = 25;
  if (a.hasSignLanguage) score += 50;
  if (a.hasQuietZone) score += 25;
  return Math.min(100, score);
}

/** Cognitive-accessibility heuristic from one analysis (0-100). */
function cognitiveScore(a: AIAnalysis): number {
  let score = 40;
  if (a.hasQuietZone) score += 30;
  if (a.lightingLevel === 'high') score += 20;
  if (a.crowdLevel === 'low') score += 10;
  return Math.min(100, score);
}

/** Sensory-friendliness heuristic from one analysis (0-100). */
function sensoryScore(a: AIAnalysis): number {
  const noise = intensityFriendliness(a.noiseLevel);
  // Treat "high" lighting as friendly (well-lit); flip the mapping for lighting.
  const light = a.lightingLevel === 'high'
    ? 100
    : intensityFriendliness(a.lightingLevel);
  const crowd = intensityFriendliness(a.crowdLevel);
  return Math.round((noise + light + crowd) / 3);
}

/* -------------------------------------------------------------------------- */
/*  Place-level aggregation                                                   */
/* -------------------------------------------------------------------------- */

/** Round to nearest int and clamp to [0, 100]. */
function clamp100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Combine a set of vision analyses for one place into fresh `AccessibilityScores`.
 * Each analysis is weighted by recency (see `getRecencyWeight`).
 */
export function aggregateScores(analyses: AIAnalysis[]): AccessibilityScores {
  if (analyses.length === 0) {
    return { overall: 0, mobility: 0, visual: 0, hearing: 0, cognitive: 0, sensory: 0 };
  }

  const now = Date.now();
  const rows = analyses.map((a) => ({
    weight: getRecencyWeight(a.lastAnalyzed, now),
    overall: a.accessibilityScore,
    mobility: a.wheelchairScore,
    visual: a.visualScore,
    hearing: hearingScore(a),
    cognitive: cognitiveScore(a),
    sensory: sensoryScore(a),
  }));

  const byCategory = (key: 'overall' | 'mobility' | 'visual' | 'hearing' | 'cognitive' | 'sensory'): WeightedValue[] =>
    rows.map((r) => ({ value: r[key], weight: r.weight }));

  return {
    overall: clamp100(weightedAverage(byCategory('overall'))),
    mobility: clamp100(weightedAverage(byCategory('mobility'))),
    visual: clamp100(weightedAverage(byCategory('visual'))),
    hearing: clamp100(weightedAverage(byCategory('hearing'))),
    cognitive: clamp100(weightedAverage(byCategory('cognitive'))),
    sensory: clamp100(weightedAverage(byCategory('sensory'))),
  };
}

/* -------------------------------------------------------------------------- */
/*  Agent                                                                     */
/* -------------------------------------------------------------------------- */

export const scoringAgent = {
  name: 'AccessibilityScoringAgent' as const,
  getRecencyWeight,
  weightedAverage,
  aggregateScores,

  /**
   * Recompute and persist the `accessibilityScores` block for a place.
   * @param placeId Firestore id of the place to update.
   * @param analyses All vision analyses currently known for the place.
   * @returns The freshly computed scores that were written.
   */
  async updatePlaceScore(
    placeId: string,
    analyses: AIAnalysis[],
  ): Promise<AccessibilityScores> {
    const scores = aggregateScores(analyses);
    await updatePlaceScores(placeId, scores);
    return scores;
  },
};
