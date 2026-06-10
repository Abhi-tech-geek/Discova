/**
 * Recommendation Agent.
 * Uses Groq (llama-3.3-70b-versatile) to pick the top 3 places that best match
 * the user's disability profile. Reasons are returned in Hinglish.
 */

import Groq from 'groq-sdk';

import type {
  DisabilityType,
  Place,
  PlaceSummary,
  Recommendation,
  RecommendationOutput,
} from '../../types';

const API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const MODEL_NAME = 'llama-3.3-70b-versatile';
const MAX_RECOMMENDATIONS = 3;

const SYSTEM_PROMPT = `You are a friendly accessibility-aware travel guide for Discova.
You pick the top 3 places that best fit a user's disability needs.
For every pick you write a short, friendly reason in ENGLISH (e.g. "Step-free entrance and wide aisles make it easy to get around").
Return ONLY valid JSON. No markdown. No backticks. No prose.`;

/** Raw JSON shape Groq is asked to return. All fields are best-effort. */
interface GroqRecommendationItem {
  placeId?: string;
  placeName?: string;
  reason?: string;
  matchScore?: number;
}

interface GroqRecommendationResponse {
  recommendations?: GroqRecommendationItem[];
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Project a full `Place` down to the fields the LLM actually needs. */
function summarize(place: Place): PlaceSummary {
  const features = place.aiAnalysis
    ? place.aiAnalysis.detectedFeatures.slice(0, 8)
    : [];
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    city: place.city,
    accessibilityScores: place.accessibilityScores,
    features,
  };
}

/** Strip markdown fences Groq may wrap around the JSON payload. */
function stripFences(raw: string): string {
  return raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

/** Coerce an unknown number to [0, 100]. */
function clampScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

/**
 * Construct a deterministic fallback that ranks places by overall score,
 * used when Groq is unavailable or returns junk.
 */
function safeDefault(places: PlaceSummary[]): RecommendationOutput {
  const ranked = [...places]
    .sort((a, b) => b.accessibilityScores.overall - a.accessibilityScores.overall)
    .slice(0, MAX_RECOMMENDATIONS);
  const recommendations: Recommendation[] = ranked.map((p) => ({
    placeId: p.id,
    placeName: p.name,
    reason: 'Good overall accessibility score.',
    matchScore: clampScore(p.accessibilityScores.overall),
  }));
  return { recommendations };
}

/** Look up the original place by id so we can backfill name if Groq mangles it. */
function findById(summaries: PlaceSummary[], id: string): PlaceSummary | undefined {
  return summaries.find((s) => s.id === id);
}

/**
 * Convert the validated Groq response into the typed `RecommendationOutput`.
 * Drops recommendations whose placeId does not match the input set so the LLM
 * can't invent places that don't exist.
 */
function buildOutput(
  parsed: GroqRecommendationResponse,
  summaries: PlaceSummary[],
): RecommendationOutput {
  const raw = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  const recommendations: Recommendation[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break;
    if (typeof item.placeId !== 'string') continue;
    const id = item.placeId.trim();
    if (seen.has(id)) continue;
    const match = findById(summaries, id);
    if (!match) continue;
    seen.add(id);
    recommendations.push({
      placeId: id,
      placeName:
        typeof item.placeName === 'string' && item.placeName.trim().length > 0
          ? item.placeName.trim()
          : match.name,
      reason:
        typeof item.reason === 'string' && item.reason.trim().length > 0
          ? item.reason.trim()
          : 'A good fit for your needs.',
      matchScore: clampScore(item.matchScore),
    });
  }

  return { recommendations };
}

/** Compose the user-side prompt with disability context + the candidate set. */
function buildUserPrompt(
  disabilityType: DisabilityType,
  summaries: PlaceSummary[],
): string {
  const places = summaries.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    city: p.city,
    scores: p.accessibilityScores,
    features: p.features,
  }));
  return [
    `User disability profile: ${disabilityType}`,
    '',
    'Candidate places (pick the best 3 from these — do not invent new ones):',
    JSON.stringify(places, null, 2),
    '',
    'Return ONE JSON object shaped like:',
    '{',
    '  "recommendations": [',
    '    { "placeId": string, "placeName": string, "reason": string (English, 1-2 sentences), "matchScore": number (0-100) },',
    '    ... up to 3 entries, ordered best first',
    '  ]',
    '}',
    'Return ONLY the JSON. No markdown. No prose.',
  ].join('\n');
}

/* -------------------------------------------------------------------------- */
/*  Agent                                                                     */
/* -------------------------------------------------------------------------- */

const client = API_KEY
  ? new Groq({ apiKey: API_KEY, dangerouslyAllowBrowser: true })
  : null;

export const recommendationAgent = {
  name: 'RecommendationAgent' as const,
  model: MODEL_NAME,

  /**
   * Pick the top 3 places that best match a user's disability profile.
   * Never throws — falls back to a score-sorted ranking on any error.
   * @param disabilityType The user's primary disability category.
   * @param places Candidate places to rank (full Place objects; internally summarized).
   */
  async recommend(
    disabilityType: DisabilityType,
    places: Place[],
  ): Promise<RecommendationOutput> {
    const summaries = places.map(summarize);
    if (summaries.length === 0) return { recommendations: [] };
    if (!client) return safeDefault(summaries);

    try {
      const completion = await client.chat.completions.create({
        model: MODEL_NAME,
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(disabilityType, summaries) },
        ],
      });

      const text = completion.choices[0]?.message?.content ?? '';
      const cleaned = stripFences(text);

      try {
        const parsed = JSON.parse(cleaned) as GroqRecommendationResponse;
        const output = buildOutput(parsed, summaries);
        return output.recommendations.length > 0 ? output : safeDefault(summaries);
      } catch {
        return safeDefault(summaries);
      }
    } catch {
      return safeDefault(summaries);
    }
  },
};
