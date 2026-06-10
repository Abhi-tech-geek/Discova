/**
 * Place Analysis Agent.
 *
 * Auto-decides how accessible a Google place is, using only data Google gives:
 *   1. Photo → Gemini vision (ramp / lift / stairs / scores)   [visionAgent]
 *   2. User reviews → Groq summary of accessibility mentions    [this file]
 *   3. Combine → `AccessibilityScores` + a human summary        [scoringAgent]
 *
 * Never throws — every failure path returns a safe partial result so the
 * place-detail screen always renders something.
 */

import Groq from 'groq-sdk';
import * as ImageManipulator from 'expo-image-manipulator';

import { aggregateScores } from './scoringAgent';
import { visionAgent } from './visionAgent';
import type { AIAnalysis, AccessibilityScores } from '../../types';

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const groq = GROQ_KEY
  ? new Groq({ apiKey: GROQ_KEY, dangerouslyAllowBrowser: true })
  : null;

/** Combined output for one place. */
export interface PlaceAnalysisResult {
  scores: AccessibilityScores;
  analysis: AIAnalysis;
}

/** Per-category accessibility hints extracted from reviews (0-10, -1 = unknown). */
interface ReviewSummary {
  summary: string;
  accessibilityMentions: string[];
  warnings: string[];
  overallHint: number;
  mobilityHint: number;
  visualHint: number;
  hearingHint: number;
}

/** Strip markdown fences from an LLM response. */
function stripFences(raw: string): string {
  return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
}

/**
 * Download a remote photo and return its base64 (resized + JPEG-compressed).
 * Returns `''` on failure.
 */
async function urlToBase64(url: string): Promise<string> {
  try {
    const out = await ImageManipulator.manipulateAsync(
      url,
      [{ resize: { width: 1024 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    return out.base64 ?? '';
  } catch {
    return '';
  }
}

/** Clamp an unknown value to a 0-10 hint, or -1 when not a usable number. */
function clampHint(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return -1;
  return Math.max(-1, Math.min(10, value));
}

/** Summarize per-category accessibility signals from reviews via Groq. */
async function summarizeReviews(
  placeName: string,
  reviews: string[],
): Promise<ReviewSummary> {
  const fallback: ReviewSummary = {
    summary: '',
    accessibilityMentions: [],
    warnings: [],
    overallHint: -1,
    mobilityHint: -1,
    visualHint: -1,
    hearingHint: -1,
  };
  if (!groq || reviews.length === 0) return fallback;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an accessibility analyst. Read place reviews and extract accessibility signals (ramps, lifts, stairs, wheelchair access, washroom, parking, lighting, crowd, noise, braille, staff help). Respond ONLY in English. Return ONLY JSON. No markdown.',
        },
        {
          role: 'user',
          content: [
            `Place: ${placeName}`,
            'Reviews:',
            reviews.map((r, i) => `${i + 1}. ${r}`).join('\n'),
            '',
            'Return JSON (English only):',
            '{',
            '  "summary": string (1-2 sentences on accessibility, under 40 words, English),',
            '  "accessibilityMentions": string[] (positive access features mentioned),',
            '  "warnings": string[] (access barriers mentioned),',
            '  "overallHint": number 0-10 (overall accessibility; -1 if reviews say nothing),',
            '  "mobilityHint": number 0-10 (wheelchair / step-free / ramp / lift; -1 if unknown),',
            '  "visualHint": number 0-10 (lighting / signage / braille for low vision; -1 if unknown),',
            '  "hearingHint": number 0-10 (quiet / staff communication / hearing support; -1 if unknown)',
            '}',
          ].join('\n'),
        },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(stripFences(text)) as Record<string, unknown>;
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      accessibilityMentions: Array.isArray(parsed.accessibilityMentions)
        ? parsed.accessibilityMentions.filter((m): m is string => typeof m === 'string')
        : [],
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.filter((m): m is string => typeof m === 'string')
        : [],
      overallHint: clampHint(parsed.overallHint),
      mobilityHint: clampHint(parsed.mobilityHint),
      visualHint: clampHint(parsed.visualHint),
      hearingHint: clampHint(parsed.hearingHint),
    };
  } catch {
    return fallback;
  }
}

/** Blend a vision-derived 0-100 score with a review 0-10 hint. */
function blendScore(visionScore: number, reviewHint: number): number {
  if (reviewHint < 0) return visionScore; // no review signal
  const reviewScore = reviewHint * 10;
  if (visionScore <= 0) return reviewScore; // photo couldn't tell → trust reviews
  return Math.round((visionScore + reviewScore) / 2); // both → average
}

export const placeAnalysisAgent = {
  name: 'PlaceAccessibilityAnalyzer' as const,

  /**
   * Analyze a Google place's photos + reviews and decide its accessibility.
   * @param input.name Place name.
   * @param input.photos Photo URLs from Google (first usable one is vision-analyzed).
   * @param input.reviews Review texts from Google.
   */
  async analyzePlace(input: {
    name: string;
    photos: string[];
    reviews: string[];
  }): Promise<PlaceAnalysisResult> {
    // 1 + 2 in parallel: vision over the first photo, Groq over the reviews.
    const firstPhoto = input.photos[0] ?? '';
    const [base64, reviewSummary] = await Promise.all([
      firstPhoto ? urlToBase64(firstPhoto) : Promise.resolve(''),
      summarizeReviews(input.name, input.reviews),
    ]);

    const vision: AIAnalysis = base64
      ? await visionAgent.analyze(base64)
      : await visionAgent.analyze(''); // returns safe default when empty

    // 3. Blend reviews into EACH category (photo + reviews together).
    const blended: AIAnalysis = {
      ...vision,
      accessibilityScore: blendScore(vision.accessibilityScore, reviewSummary.overallHint),
      wheelchairScore: blendScore(vision.wheelchairScore, reviewSummary.mobilityHint),
      visualScore: blendScore(vision.visualScore, reviewSummary.visualHint),
      detectedFeatures: Array.from(
        new Set([...vision.detectedFeatures, ...reviewSummary.accessibilityMentions]),
      ).slice(0, 10),
      warningFeatures: Array.from(
        new Set([...vision.warningFeatures, ...reviewSummary.warnings]),
      ).slice(0, 10),
      summary:
        [vision.summary, reviewSummary.summary]
          .filter((s) => s && s !== 'Analysis unavailable.')
          .join(' ') || 'Not enough data to assess accessibility yet.',
      lastAnalyzed: Date.now(),
    };

    // Vision-heuristic scores, then overlay the review hints for the
    // categories photos can't show (hearing especially).
    const base = aggregateScores([blended]);
    const scores = {
      ...base,
      hearing:
        reviewSummary.hearingHint >= 0
          ? blendScore(base.hearing, reviewSummary.hearingHint)
          : base.hearing,
      overall:
        reviewSummary.overallHint >= 0
          ? blendScore(base.overall, reviewSummary.overallHint)
          : base.overall,
    };

    return { scores, analysis: blended };
  },
};
