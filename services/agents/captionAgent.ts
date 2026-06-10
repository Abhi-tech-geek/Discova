/**
 * Caption Generator Agent.
 * Uses Groq (llama-3.1-8b-instant) to turn a vision analysis into a
 * social-media-ready caption, vibe tags, hashtags, emojis, and accessibility tags.
 */

import Groq from 'groq-sdk';

import type {
  AIAnalysis,
  CaptionOutput,
  DisabilityType,
  VibeTag,
} from '../../types';

const API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const MODEL_NAME = 'llama-3.1-8b-instant';

const VIBE_TAGS: readonly VibeTag[] = [
  'chill',
  'cozy',
  'lively',
  'trendy',
  'authentic',
  'romantic',
  'family-friendly',
  'instagrammable',
  'foodie',
  'hidden-gem',
  'quiet',
  'accessible',
] as const;

const DISABILITY_TAGS: readonly DisabilityType[] = [
  'mobility',
  'visual',
  'hearing',
  'cognitive',
  'sensory',
  'none',
] as const;

const SYSTEM_PROMPT = `You are a social media expert for an accessibility-focused travel app called Discova.
You write punchy, modern, inclusive captions for places people visit.
Return ONLY valid JSON. No markdown. No backticks. No prose before or after.`;

/** Raw JSON shape Groq is asked to return. All fields best-effort. */
interface GroqCaptionResponse {
  caption?: string;
  vibeTags?: string[];
  hashtags?: string[];
  emojis?: string[];
  accessibilityTags?: string[];
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Build a safe fallback caption used when Groq fails or returns junk. */
function safeDefault(placeName: string): CaptionOutput {
  const slug = placeName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
  return {
    caption: `${placeName} — worth the stop ✨`,
    vibeTags: ['chill'],
    hashtags: [
      slug ? `#${slug}` : '#discova',
      '#discova',
      '#accessibletravel',
      '#travelgram',
      '#explore',
    ],
    emojis: ['📍', '✨', '🌍'],
    accessibilityTags: [],
  };
}

/** Strip markdown fences Groq may wrap around the JSON payload. */
function stripFences(raw: string): string {
  return raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

/** Coerce an unknown value to a non-empty string, falling back to `fallback`. */
function toStringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** Filter a candidate array down to entries that belong to an allow-list. */
function filterToAllowed<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<string>(allowed);
  const out: T[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const norm = item.trim().toLowerCase() as T;
    if (set.has(norm) && !out.includes(norm)) out.push(norm);
  }
  return out;
}

/** Pull up to N raw strings out of an unknown array (used for hashtags / emojis). */
function takeStrings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

/** Ensure every hashtag starts with `#` and contains no whitespace. */
function normalizeHashtags(value: unknown): string[] {
  return takeStrings(value, 5).map((tag) => {
    const stripped = tag.replace(/\s+/g, '');
    return stripped.startsWith('#') ? stripped : `#${stripped}`;
  });
}

/**
 * Convert a validated Groq response into the typed `CaptionOutput` object.
 * Clamps caption length, filters tags to the allow-list, and normalizes hashtags.
 */
function buildOutput(parsed: GroqCaptionResponse, placeName: string): CaptionOutput {
  const fallback = safeDefault(placeName);
  const captionRaw = toStringOr(parsed.caption, fallback.caption);
  const caption = captionRaw.length > 80 ? `${captionRaw.slice(0, 77)}...` : captionRaw;

  const vibeTags = filterToAllowed<VibeTag>(parsed.vibeTags, VIBE_TAGS).slice(0, 3);
  const accessibilityTags = filterToAllowed<DisabilityType>(
    parsed.accessibilityTags,
    DISABILITY_TAGS,
  ).filter((t) => t !== 'none');

  const hashtags = normalizeHashtags(parsed.hashtags);
  const emojis = takeStrings(parsed.emojis, 3);

  return {
    caption,
    vibeTags: vibeTags.length > 0 ? vibeTags : fallback.vibeTags,
    hashtags: hashtags.length > 0 ? hashtags : fallback.hashtags,
    emojis: emojis.length > 0 ? emojis : fallback.emojis,
    accessibilityTags,
  };
}

/** Compose the user-side prompt with all place + analysis context. */
function buildUserPrompt(
  analysis: AIAnalysis,
  placeName: string,
  placeType: string,
): string {
  return [
    `Place: ${placeName}`,
    `Type: ${placeType}`,
    '',
    'Accessibility signals from the photo:',
    `- ramp: ${analysis.hasRamp}`,
    `- elevator: ${analysis.hasElevator}`,
    `- wide entrance: ${analysis.hasWideEntries}`,
    `- accessible parking: ${analysis.hasAccessibleParking}`,
    `- accessible washroom: ${analysis.hasAccessibleRestroom}`,
    `- stairs: ${analysis.hasStairs} (${analysis.stairsCount} steps)`,
    `- narrow door: ${analysis.hasNarrowDoor}`,
    `- lighting level: ${analysis.lightingLevel}`,
    `- detected features: ${analysis.detectedFeatures.join(', ') || 'none'}`,
    `- warnings: ${analysis.warningFeatures.join(', ') || 'none'}`,
    `- summary: ${analysis.summary}`,
    '',
    'Return ONE JSON object with these fields:',
    '{',
    '  "caption": string (under 80 characters, punchy, friendly tone, no hashtags inside),',
    `  "vibeTags": array of 2-3 values chosen from [${VIBE_TAGS.join(', ')}],`,
    '  "hashtags": array of exactly 5 hashtags (each starts with "#", no spaces),',
    '  "emojis": array of exactly 3 emojis,',
    `  "accessibilityTags": array chosen from [${DISABILITY_TAGS.filter((t) => t !== 'none').join(', ')}] reflecting which groups the detected features actually help`,
    '}',
    'Return ONLY the JSON object. No prose. No markdown.',
  ].join('\n');
}

/* -------------------------------------------------------------------------- */
/*  Agent                                                                     */
/* -------------------------------------------------------------------------- */

const client = API_KEY
  ? new Groq({ apiKey: API_KEY, dangerouslyAllowBrowser: true })
  : null;

export const captionAgent = {
  name: 'CaptionGeneratorAgent' as const,
  model: MODEL_NAME,

  /**
   * Generate a caption + tags for a place from its vision analysis.
   * Never throws — on network, parse, or schema errors a safe default is returned.
   * @param analysis Vision agent output for the place's primary photo.
   * @param placeName Display name of the place (e.g. "Cafe Coffee Day").
   * @param placeType Coarse category (e.g. "cafe", "park", "museum").
   */
  async generate(
    analysis: AIAnalysis,
    placeName: string,
    placeType: string,
  ): Promise<CaptionOutput> {
    if (!client) {
      return safeDefault(placeName);
    }

    try {
      const completion = await client.chat.completions.create({
        model: MODEL_NAME,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(analysis, placeName, placeType) },
        ],
      });

      const text = completion.choices[0]?.message?.content ?? '';
      const cleaned = stripFences(text);

      try {
        const parsed = JSON.parse(cleaned) as GroqCaptionResponse;
        return buildOutput(parsed, placeName);
      } catch {
        return safeDefault(placeName);
      }
    } catch {
      return safeDefault(placeName);
    }
  },
};
