/**
 * Google Maps service.
 *
 * Thin wrapper around the Google Maps Web Services REST APIs:
 *   - Places Autocomplete  (search-as-you-type)
 *   - Place Details        (full info for one place id)
 *   - Geocoding            (lat/lng → address)
 *   - Directions           (route polyline + duration)
 *
 * Plus a couple of pure-math helpers (`calculateDistanceKm`, `isInDelhi`)
 * that don't hit the network.
 *
 * Every API call is wrapped in try/catch and returns either a typed result
 * or `null` — never throws. Screens are expected to surface a friendly
 * "couldn't load" message rather than handle Google-specific error codes.
 */

import type { AccessibilityScores, Place } from '../types';
import type { GeoPoint } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';
const BASE = 'https://maps.googleapis.com/maps/api';

/** Is a Google Maps key configured? Screens use this to fall back to seed data. */
export function hasGoogleKey(): boolean {
  return API_KEY.length > 0;
}

/* -------------------------------------------------------------------------- */
/*  Public types                                                              */
/* -------------------------------------------------------------------------- */

/** One result row from Places Autocomplete. */
export interface PlaceAutocompleteResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  /** Google place types — used to tell an area (locality) from a business. */
  types: string[];
}

/** Detailed place info for a single id. */
export interface PlaceDetailsResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  location: GeoPoint;
  city: string;
  category: string;
  rating: number;
  totalReviews: number;
  phoneNumber: string | null;
  website: string | null;
  photos: string[];
  /** Up to 5 user reviews (for display + AI accessibility summary). */
  reviews: GoogleReview[];
  isOpenNow: boolean | null;
  /** Today's open/close, formatted (e.g. { open: '9:00 AM', close: '10:00 PM' }). */
  todayHours: { open: string; close: string } | null;
  /** Google's human-readable weekly hours (7 strings), if available. */
  weekdayText: string[];
}

/** One Google review. */
export interface GoogleReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

/** Result of a reverse geocode lookup. */
export interface ReverseGeocodeResult {
  formattedAddress: string;
  city: string;
  country: string;
  postalCode: string | null;
}

/** Travel mode for directions queries. */
export type TravelMode = 'driving' | 'walking' | 'transit' | 'bicycling';

/** Directions result — one route, summarized. */
export interface DirectionsResult {
  /** Encoded polyline (Google's polyline algorithm). */
  polyline: string;
  /** Total distance in metres. */
  distanceMeters: number;
  /** Human-readable distance label, e.g. "3.2 km". */
  distanceLabel: string;
  /** Total duration in seconds. */
  durationSeconds: number;
  /** Human-readable duration label, e.g. "11 mins". */
  durationLabel: string;
  /** Step-by-step instructions (stripped of HTML). */
  steps: string[];
}

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

/** Append `key=...` query param to a base URL. */
function withKey(url: string, extra: Record<string, string>): string {
  const params = new URLSearchParams({ ...extra, key: API_KEY });
  return `${url}?${params.toString()}`;
}

/** Strip HTML tags Google returns inside step instructions. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Best-effort fetch + JSON.parse — returns `null` on any failure. */
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** Extract the "locality" component (city) from a geocode `address_components` array. */
function pickComponent(
  components: Array<{ types: string[]; long_name: string }> | undefined,
  type: string,
): string {
  if (!components) return '';
  const match = components.find((c) => c.types.includes(type));
  return match?.long_name ?? '';
}

/* -------------------------------------------------------------------------- */
/*  Pure-math helpers (no network)                                            */
/* -------------------------------------------------------------------------- */

const EARTH_RADIUS_KM = 6371;

/** Convert degrees to radians. */
function deg2rad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two points, in kilometres (Haversine).
 * Accurate enough for "how far is this place" UI labels.
 */
export function calculateDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = deg2rad(to.latitude - from.latitude);
  const dLng = deg2rad(to.longitude - from.longitude);
  const lat1 = deg2rad(from.latitude);
  const lat2 = deg2rad(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Loose bounding-box check for Delhi NCR. */
export function isInDelhi({ latitude, longitude }: GeoPoint): boolean {
  return (
    latitude >= 28.3 &&
    latitude <= 28.9 &&
    longitude >= 76.8 &&
    longitude <= 77.5
  );
}

/* -------------------------------------------------------------------------- */
/*  Places Autocomplete                                                       */
/* -------------------------------------------------------------------------- */

interface AutocompletePrediction {
  place_id: string;
  description: string;
  types?: string[];
  structured_formatting?: { main_text?: string; secondary_text?: string };
}

interface AutocompleteResponse {
  status: string;
  predictions: AutocompletePrediction[];
}

/**
 * Place autocomplete — search-as-you-type.
 * @param query Text typed by the user.
 * @param location Optional bias toward a lat/lng + radius (metres).
 * @param countryCode Optional ISO 3166-1 alpha-2 (e.g. `'in'`) to restrict to one country.
 * @returns Up to 5 predictions, or `[]` on error / empty query.
 */
export async function searchPlaces(
  query: string,
  location?: GeoPoint,
  countryCode: string = 'in',
): Promise<PlaceAutocompleteResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0 || API_KEY.length === 0) return [];

  const params: Record<string, string> = {
    input: trimmed,
    components: `country:${countryCode}`,
  };
  if (location) {
    params.location = `${location.latitude},${location.longitude}`;
    params.radius = '50000';
  }

  const url = withKey(`${BASE}/place/autocomplete/json`, params);
  const data = await fetchJson<AutocompleteResponse>(url);
  if (!data || data.status !== 'OK') return [];

  return data.predictions.slice(0, 6).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? '',
    types: p.types ?? [],
  }));
}

/* -------------------------------------------------------------------------- */
/*  Place Details                                                             */
/* -------------------------------------------------------------------------- */

interface PlaceDetailsResponse {
  status: string;
  result?: {
    place_id: string;
    name: string;
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
    types?: string[];
    rating?: number;
    user_ratings_total?: number;
    formatted_phone_number?: string;
    website?: string;
    photos?: Array<{ photo_reference: string }>;
    opening_hours?: {
      open_now?: boolean;
      weekday_text?: string[];
      periods?: Array<{
        open?: { day: number; time: string };
        close?: { day: number; time: string };
      }>;
    };
    address_components?: Array<{ types: string[]; long_name: string }>;
    reviews?: Array<{
      author_name?: string;
      rating?: number;
      text?: string;
      relative_time_description?: string;
    }>;
  };
}

/** Build a usable photo URL from a Place Details `photo_reference`. */
function photoRefToUrl(ref: string, maxWidth: number = 800): string {
  return `${BASE}/place/photo?maxwidth=${maxWidth}&photoreference=${ref}&key=${API_KEY}`;
}

/** Format a Google "HHmm" time string into "h:mm AM/PM". */
function formatClock(hhmm: string): string {
  if (hhmm.length < 4) return '';
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = hhmm.slice(2, 4);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m} ${ampm}`;
}

/** Pull today's open/close from the Places `periods` array (null if unknown). */
function parseTodayHours(
  periods?: Array<{ open?: { day: number; time: string }; close?: { day: number; time: string } }>,
): { open: string; close: string } | null {
  if (!periods || periods.length === 0) return null;
  const today = new Date().getDay();
  // Open 24h is encoded as a single period with open.time "0000" and no close.
  if (periods.length === 1 && periods[0].open?.time === '0000' && !periods[0].close) {
    return { open: 'Open 24 hours', close: '' };
  }
  const p = periods.find((x) => x.open?.day === today && x.close);
  if (!p || !p.open || !p.close) return null;
  return { open: formatClock(p.open.time), close: formatClock(p.close.time) };
}

/**
 * Full details for one place id.
 * @returns `null` if the place can't be loaded or is missing.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResult | null> {
  if (placeId.length === 0 || API_KEY.length === 0) return null;
  const url = withKey(`${BASE}/place/details/json`, {
    place_id: placeId,
    fields: [
      'place_id',
      'name',
      'formatted_address',
      'geometry/location',
      'types',
      'rating',
      'user_ratings_total',
      'formatted_phone_number',
      'website',
      'photos',
      'opening_hours/open_now',
      'opening_hours/weekday_text',
      'opening_hours/periods',
      'address_components',
      'reviews',
    ].join(','),
  });

  const data = await fetchJson<PlaceDetailsResponse>(url);
  if (!data || data.status !== 'OK' || !data.result) return null;
  const r = data.result;
  const loc = r.geometry?.location;

  return {
    placeId: r.place_id,
    name: r.name,
    formattedAddress: r.formatted_address ?? '',
    location: {
      latitude: loc?.lat ?? 0,
      longitude: loc?.lng ?? 0,
    },
    city: pickComponent(r.address_components, 'locality') || pickComponent(r.address_components, 'administrative_area_level_2'),
    category: r.types?.[0] ?? '',
    rating: r.rating ?? 0,
    totalReviews: r.user_ratings_total ?? 0,
    phoneNumber: r.formatted_phone_number ?? null,
    website: r.website ?? null,
    photos: (r.photos ?? []).slice(0, 5).map((p) => photoRefToUrl(p.photo_reference)),
    reviews: (r.reviews ?? [])
      .filter((rv) => (rv.text ?? '').trim().length > 0)
      .slice(0, 5)
      .map((rv) => ({
        author: rv.author_name ?? 'Anonymous',
        rating: rv.rating ?? 0,
        text: rv.text ?? '',
        relativeTime: rv.relative_time_description ?? '',
      })),
    isOpenNow: r.opening_hours?.open_now ?? null,
    todayHours: parseTodayHours(r.opening_hours?.periods),
    weekdayText: r.opening_hours?.weekday_text ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/*  Geocoding                                                                 */
/* -------------------------------------------------------------------------- */

interface GeocodeResponse {
  status: string;
  results: Array<{
    formatted_address: string;
    address_components: Array<{ types: string[]; long_name: string }>;
  }>;
}

/**
 * Reverse geocode lat/lng → formatted address + city / country / postal.
 * @returns `null` if the lookup fails.
 */
export async function reverseGeocode(
  point: GeoPoint,
): Promise<ReverseGeocodeResult | null> {
  if (API_KEY.length === 0) return null;
  const url = withKey(`${BASE}/geocode/json`, {
    latlng: `${point.latitude},${point.longitude}`,
  });

  const data = await fetchJson<GeocodeResponse>(url);
  if (!data || data.status !== 'OK' || data.results.length === 0) return null;
  const top = data.results[0];

  return {
    formattedAddress: top.formatted_address,
    city:
      pickComponent(top.address_components, 'locality') ||
      pickComponent(top.address_components, 'administrative_area_level_2'),
    country: pickComponent(top.address_components, 'country'),
    postalCode: pickComponent(top.address_components, 'postal_code') || null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Directions                                                                */
/* -------------------------------------------------------------------------- */

interface DirectionsResponse {
  status: string;
  routes: Array<{
    overview_polyline?: { points: string };
    legs?: Array<{
      distance?: { value: number; text: string };
      duration?: { value: number; text: string };
      steps?: Array<{ html_instructions?: string }>;
    }>;
  }>;
}

/**
 * Driving / walking / transit directions between two points.
 * Caller can render `polyline` directly via `react-native-maps`' `Polyline`.
 * @returns `null` if no route is found.
 */
export async function getDirections(
  origin: GeoPoint,
  destination: GeoPoint,
  mode: TravelMode = 'driving',
): Promise<DirectionsResult | null> {
  if (API_KEY.length === 0) return null;
  const url = withKey(`${BASE}/directions/json`, {
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode,
  });

  const data = await fetchJson<DirectionsResponse>(url);
  if (!data || data.status !== 'OK' || data.routes.length === 0) return null;
  const route = data.routes[0];
  const leg = route.legs?.[0];
  if (!leg) return null;

  const steps = (leg.steps ?? [])
    .map((s) => stripHtml(s.html_instructions ?? ''))
    .filter((s) => s.length > 0);

  return {
    polyline: route.overview_polyline?.points ?? '',
    distanceMeters: leg.distance?.value ?? 0,
    distanceLabel: leg.distance?.text ?? '',
    durationSeconds: leg.duration?.value ?? 0,
    durationLabel: leg.duration?.text ?? '',
    steps,
  };
}

/* -------------------------------------------------------------------------- */
/*  Nearby Search                                                             */
/* -------------------------------------------------------------------------- */

interface NearbyResultRaw {
  place_id: string;
  name: string;
  vicinity?: string;
  geometry?: { location?: { lat: number; lng: number } };
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  photos?: Array<{ photo_reference: string }>;
  opening_hours?: { open_now?: boolean };
}

interface NearbyResponse {
  status: string;
  results: NearbyResultRaw[];
}

/** One nearby place, in our app's domain shape (not yet accessibility-scored). */
export interface NearbyPlace {
  placeId: string;
  name: string;
  address: string;
  location: GeoPoint;
  category: string;
  rating: number;
  totalReviews: number;
  photos: string[];
  isOpenNow: boolean | null;
}

/**
 * Find places near a coordinate (Google Places "Nearby Search").
 * @param center Latitude / longitude to search around.
 * @param radiusMeters Search radius (default 2 km).
 * @param keyword Optional keyword (e.g. "cafe", "park"). Empty = all types.
 * @returns Up to 20 nearby places, or `[]` on error / no key.
 */
export async function getNearbyPlaces(
  center: GeoPoint,
  radiusMeters: number = 2000,
  keyword: string = '',
  type: string = '',
): Promise<NearbyPlace[]> {
  if (API_KEY.length === 0) return [];

  const params: Record<string, string> = {
    location: `${center.latitude},${center.longitude}`,
    radius: String(radiusMeters),
  };
  if (keyword.trim().length > 0) params.keyword = keyword.trim();
  if (type.trim().length > 0) params.type = type.trim();

  const url = withKey(`${BASE}/place/nearbysearch/json`, params);
  const data = await fetchJson<NearbyResponse>(url);
  if (!data || data.status !== 'OK') return [];

  return data.results
    .filter((r) => r.geometry?.location)
    .slice(0, 20)
    .map((r) => ({
      placeId: r.place_id,
      name: r.name,
      address: r.vicinity ?? '',
      location: {
        latitude: r.geometry?.location?.lat ?? 0,
        longitude: r.geometry?.location?.lng ?? 0,
      },
      category: r.types?.[0] ?? 'point_of_interest',
      rating: r.rating ?? 0,
      totalReviews: r.user_ratings_total ?? 0,
      photos: (r.photos ?? []).slice(0, 3).map((p) => photoRefToUrl(p.photo_reference)),
      isOpenNow: r.opening_hours?.open_now ?? null,
    }));
}

/** Visit-worthy place categories — places people actually go OUT to. */
const ATTRACTION_TYPES = [
  'tourist_attraction',
  'restaurant',
  'cafe',
  'bakery',
  'bar',
  'park',
  'shopping_mall',
  'museum',
  'art_gallery',
  'movie_theater',
  'amusement_park',
] as const;

/** Residential / utility categories we never want in "Top picks". */
const EXCLUDED_TYPES = new Set<string>([
  'locality',
  'sublocality',
  'neighborhood',
  'premise',
  'subpremise',
  'route',
  'street_address',
  'postal_code',
  'political',
  'real_estate_agency',
  'lodging',
  'apartment_complex',
  'housing_complex',
  'gated_community',
]);

/**
 * Fetch visit-worthy nearby places (NOT residential societies).
 * Runs a parallel Nearby Search per attraction category, merges, dedupes by
 * placeId, drops residential/utility results, and sorts by rating × popularity.
 * @param center User's coordinate.
 * @param radiusMeters Search radius (default 5 km — wider net for things to do).
 */
/**
 * Merge, dedupe, filter and rank raw nearby results into genuinely good,
 * photo-having venues. Shared by `getNearbyAttractions` + `getNearbyByTypes`.
 */
function rankNearby(center: GeoPoint, places: NearbyPlace[]): NearbyPlace[] {
  const byId = new Map<string, NearbyPlace>();
  for (const place of places) {
    // Safety net: drop any residential / utility result that slipped in.
    if (EXCLUDED_TYPES.has(place.category)) continue;
    if (!byId.has(place.placeId)) byId.set(place.placeId, place);
  }

  // Rank by a "worth visiting" score — rating + popularity, lightly penalised
  // by distance — so well-loved nearby spots float to the top.
  const scored = Array.from(byId.values()).map((p) => {
    const dist = calculateDistanceKm(center, p.location);
    const popularity = Math.log10((p.totalReviews || 0) + 1); // 0..~4
    const score = (p.rating || 0) * 10 + popularity * 6 - dist * 1.2;
    return { place: p, score };
  });

  // Only genuinely good, real venues: rating ≥ 3.9, some reviews, and a photo
  // (so cards never look fake/empty). No low-rated junk fallback.
  let good = scored.filter(
    (s) =>
      (s.place.rating || 0) >= 3.9 &&
      (s.place.totalReviews || 0) >= 20 &&
      s.place.photos.length > 0,
  );
  if (good.length === 0) {
    // Sparse area — relax the review count but keep the 3.9 + photo bar.
    good = scored.filter((s) => (s.place.rating || 0) >= 3.9 && s.place.photos.length > 0);
  }

  return good.sort((a, b) => b.score - a.score).slice(0, 40).map((x) => x.place);
}

export async function getNearbyAttractions(
  center: GeoPoint,
  radiusMeters: number = 7000,
): Promise<NearbyPlace[]> {
  if (API_KEY.length === 0) return [];
  // ONLY curated visit-worthy categories — NO generic search (a generic
  // search pulls in residential societies + random shops inside them).
  const batches = await Promise.all(
    ATTRACTION_TYPES.map((t) => getNearbyPlaces(center, radiusMeters, '', t)),
  );
  return rankNearby(center, batches.flat());
}

/**
 * Nearby places matching a custom set of Google Place `type`s — used by the
 * home category chips (Calm / Family / Cafés / Parks). Same quality bar.
 */
export async function getNearbyByTypes(
  center: GeoPoint,
  radiusMeters: number,
  types: string[],
): Promise<NearbyPlace[]> {
  if (API_KEY.length === 0 || types.length === 0) return [];
  const batches = await Promise.all(
    types.map((t) => getNearbyPlaces(center, radiusMeters, '', t)),
  );
  return rankNearby(center, batches.flat());
}

/** Empty accessibility scores — assigned to fresh Google places until the
 *  community + AI fill them in. */
function emptyScores(): AccessibilityScores {
  return { overall: 0, mobility: 0, visual: 0, hearing: 0, cognitive: 0, sensory: 0 };
}

/**
 * Convert a Google nearby result into our `Place` domain type so it can be
 * rendered by the same components as Firestore-backed places.
 * @param np Nearby place from `getNearbyPlaces`.
 * @param city Resolved city name for the area.
 */
export function nearbyToPlace(np: NearbyPlace, city: string): Place {
  const now = Date.now();
  return {
    id: np.placeId,
    googlePlaceId: np.placeId,
    name: np.name,
    address: np.address,
    city,
    location: np.location,
    category: np.category.replace(/_/g, ' '),
    photos: np.photos,
    rating: np.rating,
    totalReviews: np.totalReviews,
    accessibilityScores: emptyScores(),
    aiAnalysis: null,
    phoneNumber: null,
    website: null,
    hours: null,
    createdAt: now,
    updatedAt: now,
  };
}
