/**
 * Ask DISCOVA Agent.
 *
 * Natural-language place finder: the user asks in plain language ("find a
 * quiet wheelchair-friendly cafe near me"), we fetch REAL nearby places from
 * Google for the relevant categories, and Groq (llama-3.3-70b) writes a short
 * friendly answer + picks the best-matching place ids from that real list —
 * it can never invent places.
 *
 * Never throws — falls back to a plain ranked list on any error.
 */

import Groq from 'groq-sdk';

import type { Place } from '../../types';

const API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const MODEL_NAME = 'llama-3.3-70b-versatile';
const MAX_PICKS = 4;

const SYSTEM_PROMPT = `You are "Ask Discova" — a friendly, accessibility-aware local guide.
The user asks for places in natural language. You are given a list of REAL nearby places (with ratings + accessibility info when known).
Reply in ENGLISH with:
1. "reply": 1-3 short, warm sentences answering the question and referencing your picks by name. If nothing fits well, say so honestly.
2. "placeIds": up to 4 ids picked ONLY from the provided list, best match first. Empty array if nothing fits.
Consider accessibility needs (wheelchair/step-free, quiet/sensory, family, senior) mentioned in the question.
Return ONLY valid JSON: { "reply": string, "placeIds": string[] }. No markdown. No backticks.`;

export interface AskResult {
  reply: string;
  places: Place[];
}

interface GroqAskResponse {
  reply?: string;
  placeIds?: unknown[];
}

/** Map free-text to Google Place types to fetch (local, fast, no LLM). */
export function typesForQuery(query: string): string[] {
  const q = query.toLowerCase();
  const types = new Set<string>();
  if (/(cafe|coffee|chai|tea)/.test(q)) types.add('cafe').add('bakery');
  if (/(food|restaurant|dinner|lunch|khana|eat|biryani|pizza)/.test(q)) types.add('restaurant');
  if (/(park|garden|walk|green|nature)/.test(q)) types.add('park');
  if (/(mall|shop|shopping)/.test(q)) types.add('shopping_mall');
  if (/(museum|art|history|culture)/.test(q)) types.add('museum').add('art_gallery');
  if (/(movie|cinema|film)/.test(q)) types.add('movie_theater');
  if (/(fun|kids|family|play|amusement)/.test(q)) types.add('amusement_park').add('park');
  if (/(quiet|calm|peace|sensory)/.test(q)) types.add('park').add('library').add('museum').add('cafe');
  if (/(bar|drink|pub|night)/.test(q)) types.add('bar');
  return Array.from(types);
}

/** Strip markdown fences the model may add. */
function stripFences(raw: string): string {
  return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
}

/** Compact projection of a place for the prompt. */
function summarize(p: Place) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    rating: p.rating,
    reviews: p.totalReviews,
    accessibility: p.accessibilityScores.overall > 0 ? p.accessibilityScores : 'not analysed yet',
    features: p.aiAnalysis?.detectedFeatures.slice(0, 6) ?? [],
  };
}

/** Fallback: top-rated places + an honest canned line. */
function safeDefault(places: Place[]): AskResult {
  const top = [...places].sort((a, b) => b.rating - a.rating).slice(0, MAX_PICKS);
  return {
    reply:
      top.length > 0
        ? 'Here are some well-rated nearby options. Open one to check its accessibility details.'
        : "I couldn't find good matches nearby right now. Try a different ask or area.",
    places: top,
  };
}

const client = API_KEY ? new Groq({ apiKey: API_KEY, dangerouslyAllowBrowser: true }) : null;

export const askAgent = {
  name: 'AskAgent' as const,
  model: MODEL_NAME,

  /**
   * Answer a natural-language place question using ONLY the provided real
   * candidates. Never throws.
   * @param query The user's question.
   * @param candidates Real nearby places (from Google) to choose from.
   */
  async ask(query: string, candidates: Place[]): Promise<AskResult> {
    if (candidates.length === 0) return safeDefault(candidates);
    if (!client) return safeDefault(candidates);

    try {
      const completion = await client.chat.completions.create({
        model: MODEL_NAME,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              `Question: ${query}`,
              '',
              'Nearby real places (choose ONLY from these ids):',
              JSON.stringify(candidates.slice(0, 18).map(summarize)),
            ].join('\n'),
          },
        ],
      });

      const text = completion.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(stripFences(text)) as GroqAskResponse;

      const byId = new Map(candidates.map((p) => [p.id, p]));
      const picks: Place[] = [];
      for (const raw of Array.isArray(parsed.placeIds) ? parsed.placeIds : []) {
        if (picks.length >= MAX_PICKS) break;
        if (typeof raw !== 'string') continue;
        const place = byId.get(raw.trim());
        if (place && !picks.includes(place)) picks.push(place);
      }

      const reply =
        typeof parsed.reply === 'string' && parsed.reply.trim().length > 0
          ? parsed.reply.trim()
          : safeDefault(candidates).reply;

      return { reply, places: picks.length > 0 ? picks : safeDefault(candidates).places };
    } catch {
      return safeDefault(candidates);
    }
  },
};
