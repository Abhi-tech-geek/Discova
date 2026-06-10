/**
 * Accessibility Vision Agent.
 * Wraps Google Gemini 1.5 Flash (free tier, multimodal) and returns a typed
 * `AIAnalysis` summarizing the accessibility features visible in a photo.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

import type { AIAnalysis, IntensityLevel } from '../../types';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
// gemini-1.5-flash is deprecated/removed. Use 2.5 Flash (multimodal, free tier).
const MODEL_NAME = 'gemini-2.5-flash';

const PROMPT = `You are an expert accessibility auditor.
Analyze this photo of a public place.
Return ONLY valid JSON — no markdown, no backticks.
JSON fields: ramp, lift, stairs, stairsCount, narrowDoor,
accessibleParking, accessibleWashroom, goodLighting,
wideEntrance, accessibilityScore (0-10),
wheelchairScore (0-10), visualScore (0-10),
detectedFeatures (string[]), warningFeatures (string[]),
confidence (0-1), summary (under 40 words)`;

/** Raw JSON shape Gemini is asked to return. All fields are best-effort. */
interface GeminiVisionResponse {
  ramp?: boolean;
  lift?: boolean;
  stairs?: boolean;
  stairsCount?: number;
  narrowDoor?: boolean;
  accessibleParking?: boolean;
  accessibleWashroom?: boolean;
  goodLighting?: boolean;
  wideEntrance?: boolean;
  accessibilityScore?: number;
  wheelchairScore?: number;
  visualScore?: number;
  detectedFeatures?: string[];
  warningFeatures?: string[];
  confidence?: number;
  summary?: string;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Build a safe default `AIAnalysis` used when Gemini fails or returns junk. */
function safeDefault(): AIAnalysis {
  return {
    hasRamp: false,
    hasElevator: false,
    hasBrailleSignage: false,
    hasSignLanguage: false,
    hasWideEntries: false,
    hasAccessibleParking: false,
    hasAccessibleRestroom: false,
    hasTactilePaving: false,
    hasQuietZone: false,
    hasStairs: false,
    stairsCount: 0,
    hasNarrowDoor: false,
    noiseLevel: 'medium',
    lightingLevel: 'medium',
    crowdLevel: 'medium',
    accessibilityScore: 0,
    wheelchairScore: 0,
    visualScore: 0,
    detectedFeatures: [],
    warningFeatures: [],
    summary: 'Analysis unavailable.',
    confidence: 0,
    lastAnalyzed: Date.now(),
  };
}

/** Strip any markdown fences Gemini may have wrapped around the JSON. */
function stripFences(raw: string): string {
  return raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

/** Strip any `data:image/...;base64,` prefix from an image string. */
function stripDataUrlPrefix(base64Image: string): string {
  return base64Image.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '');
}

/** Coerce an unknown value to a strict boolean. */
function toBool(value: unknown): boolean {
  return value === true;
}

/** Coerce an unknown value to a number, clamped to [min, max]. */
function toNumber(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Coerce an unknown value to a string[]. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/** Map Gemini's `goodLighting` boolean to the IntensityLevel union. */
function mapLighting(goodLighting: boolean | undefined): IntensityLevel {
  return goodLighting ? 'high' : 'medium';
}

/**
 * Convert a validated Gemini response into the typed `AIAnalysis` domain object.
 * Gemini's 0-10 scores are upscaled to 0-100 so they match `AccessibilityScores`.
 */
function buildAnalysis(parsed: GeminiVisionResponse): AIAnalysis {
  return {
    hasRamp: toBool(parsed.ramp),
    hasElevator: toBool(parsed.lift),
    hasBrailleSignage: false,
    hasSignLanguage: false,
    hasWideEntries: toBool(parsed.wideEntrance),
    hasAccessibleParking: toBool(parsed.accessibleParking),
    hasAccessibleRestroom: toBool(parsed.accessibleWashroom),
    hasTactilePaving: false,
    hasQuietZone: false,
    hasStairs: toBool(parsed.stairs),
    stairsCount: toNumber(parsed.stairsCount, 0, 999),
    hasNarrowDoor: toBool(parsed.narrowDoor),
    noiseLevel: 'medium',
    lightingLevel: mapLighting(parsed.goodLighting),
    crowdLevel: 'medium',
    accessibilityScore: toNumber(parsed.accessibilityScore, 0, 10) * 10,
    wheelchairScore: toNumber(parsed.wheelchairScore, 0, 10) * 10,
    visualScore: toNumber(parsed.visualScore, 0, 10) * 10,
    detectedFeatures: toStringArray(parsed.detectedFeatures),
    warningFeatures: toStringArray(parsed.warningFeatures),
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis unavailable.',
    confidence: toNumber(parsed.confidence, 0, 1),
    lastAnalyzed: Date.now(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Agent                                                                     */
/* -------------------------------------------------------------------------- */

const client = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export const visionAgent = {
  name: 'AccessibilityVisionAgent' as const,
  model: MODEL_NAME,

  /**
   * Run Gemini 1.5 Flash over a base64-encoded image and return the typed analysis.
   * Never throws — on network, parse, or schema errors a safe default is returned.
   * @param base64Image Raw base64 image bytes, optionally prefixed with a data URL.
   */
  async analyze(base64Image: string): Promise<AIAnalysis> {
    if (!client) {
      return safeDefault();
    }

    try {
      const generativeModel = client.getGenerativeModel({ model: MODEL_NAME });
      const result = await generativeModel.generateContent([
        PROMPT,
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: stripDataUrlPrefix(base64Image),
          },
        },
      ]);

      const text = result.response.text();
      const cleaned = stripFences(text);

      try {
        const parsed = JSON.parse(cleaned) as GeminiVisionResponse;
        return buildAnalysis(parsed);
      } catch {
        return safeDefault();
      }
    } catch {
      return safeDefault();
    }
  },
};
