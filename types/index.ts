/**
 * Discova shared types.
 * Every interface used across stores, services, agents, and screens lives here.
 */

/** Disability categories supported by the accessibility scoring + PWD mode. */
export type DisabilityType =
  | 'mobility'
  | 'visual'
  | 'hearing'
  | 'cognitive'
  | 'sensory'
  | 'none';

/** Theme mode for the app. */
export type ThemeMode = 'light' | 'dark';

/** Coarse intensity buckets used by the vision agent for ambient signals. */
export type IntensityLevel = 'low' | 'medium' | 'high';

/** Earnable badge rarity tiers. */
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Geographic point in WGS84. */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Per-category accessibility score, normalized 0-100. */
export interface AccessibilityScores {
  overall: number;
  mobility: number;
  visual: number;
  hearing: number;
  cognitive: number;
  sensory: number;
}

/** Opening hours for a single weekday (24h clock, "HH:mm"). Null when closed. */
export interface DayHours {
  open: string | null;
  close: string | null;
}

/** Mon-Sun opening hours block returned by the Places API normalization. */
export interface PlaceHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

/** User preferences persisted on the User document. */
export interface UserPreferences {
  pwdMode: boolean;
  notifications: boolean;
  preferredCategories: string[];
  preferredRadiusKm: number;
}

/** Lightweight badge reference embedded on the User document. */
export interface EarnedBadge {
  badgeId: string;
  earnedAt: number;
}

/** Activity counters used by the gamification agent to evaluate badges. */
export interface UserStats {
  postsCount: number;
  reviewsCount: number;
  placesAdded: number;
  storiesCount: number;
}

/** Full Discova user profile. */
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  bio: string;
  /** Date of birth, "DD/MM/YYYY" (empty when not provided). */
  dob: string;
  /** Gender ('' when not provided). */
  gender: 'male' | 'female' | 'other' | '';
  location: string;
  disabilityType: DisabilityType;
  pwdMode: boolean;
  coins: number;
  level: number;
  badges: EarnedBadge[];
  followers: number;
  following: number;
  joinedAt: number;
  /** Current consecutive-day activity streak. */
  streak: number;
  /** Epoch ms of the user's last active day, used to decide streak continuity. */
  lastActiveDate: number;
  stats: UserStats;
  preferences: UserPreferences;
}

/** Result of the vision agent on a place's photos. */
export interface AIAnalysis {
  hasRamp: boolean;
  hasElevator: boolean;
  hasBrailleSignage: boolean;
  hasSignLanguage: boolean;
  hasWideEntries: boolean;
  hasAccessibleParking: boolean;
  hasAccessibleRestroom: boolean;
  hasTactilePaving: boolean;
  hasQuietZone: boolean;
  hasStairs: boolean;
  stairsCount: number;
  hasNarrowDoor: boolean;
  noiseLevel: IntensityLevel;
  lightingLevel: IntensityLevel;
  crowdLevel: IntensityLevel;
  /** Overall accessibility score, 0-100. */
  accessibilityScore: number;
  /** Wheelchair-specific accessibility score, 0-100. */
  wheelchairScore: number;
  /** Visual-impairment accessibility score, 0-100. */
  visualScore: number;
  /** Positive accessibility features detected in the photo. */
  detectedFeatures: string[];
  /** Barriers / risks flagged in the photo. */
  warningFeatures: string[];
  summary: string;
  confidence: number;
  lastAnalyzed: number;
}

/** Indexable place entity. Source of truth for explore/search/place screens. */
export interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  address: string;
  city: string;
  location: GeoPoint;
  category: string;
  photos: string[];
  rating: number;
  totalReviews: number;
  accessibilityScores: AccessibilityScores;
  aiAnalysis: AIAnalysis | null;
  phoneNumber: string | null;
  website: string | null;
  hours: PlaceHours | null;
  createdAt: number;
  updatedAt: number;
}

/** User-generated post tied to a place. */
export interface Post {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL: string | null;
  placeId: string;
  placeName: string;
  imageUrl: string;
  caption: string;
  aiCaption: string;
  accessibilityTags: DisabilityType[];
  isAccessible: boolean;
  /** Accessibility score for this specific post, on a 0-10 scale. */
  accessibilityScore: number;
  likes: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: number;
}

/** Per-category 0-5 accessibility rating on a Review. */
export interface ReviewAccessibilityRatings {
  mobility: number;
  visual: number;
  hearing: number;
  cognitive: number;
  sensory: number;
}

/** Long-form user review of a place. */
export interface Review {
  id: string;
  userId: string;
  userDisplayName: string;
  placeId: string;
  rating: number;
  text: string;
  accessibilityRatings: ReviewAccessibilityRatings;
  photos: string[];
  helpfulCount: number;
  createdAt: number;
}

/** Catalog definition for a badge a user can earn. */
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  requirement: string;
  coinReward: number;
}

/** Reward catalog entry — what coins can be spent on. */
export interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  partner: string;
  category: string;
  city: string;
  available: boolean;
  expiresAt: number | null;
}

/** Media type backing a Story. */
export type StoryMediaType = 'image' | 'video';

/** Ephemeral story tied to a place; expires 24h after creation. */
export interface Story {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL: string | null;
  placeId: string;
  placeName: string;
  city: string;
  mediaUrl: string;
  mediaType: StoryMediaType;
  caption: string;
  createdAt: number;
  expiresAt: number;
}

/** Reason a coin transaction was recorded. */
export type CoinTransactionAction =
  | 'post_created'
  | 'review_created'
  | 'place_added'
  | 'badge_earned'
  | 'reward_redeemed'
  | 'daily_bonus'
  | 'level_up'
  | 'adjustment';

/** Append-only ledger entry tracking every change to a user's coin balance. */
export interface CoinTransaction {
  id: string;
  userId: string;
  amount: number;
  action: CoinTransactionAction;
  createdAt: number;
}

/** Filter applied when listing reviews on a place. */
export interface ReviewFilter {
  disabilityType?: DisabilityType;
  minRating?: number;
  withPhotosOnly?: boolean;
}

/** Fixed catalog of vibe tags the caption agent may emit. */
export type VibeTag =
  | 'chill'
  | 'cozy'
  | 'lively'
  | 'trendy'
  | 'authentic'
  | 'romantic'
  | 'family-friendly'
  | 'instagrammable'
  | 'foodie'
  | 'hidden-gem'
  | 'quiet'
  | 'accessible';

/** Social-ready content produced by the caption agent for a Post. */
export interface CaptionOutput {
  caption: string;
  vibeTags: VibeTag[];
  hashtags: string[];
  emojis: string[];
  accessibilityTags: DisabilityType[];
}

/** Minimal place projection sent to the recommendation agent. */
export interface PlaceSummary {
  id: string;
  name: string;
  category: string;
  city: string;
  accessibilityScores: AccessibilityScores;
  features: string[];
}

/** A single recommendation produced by the recommendation agent. */
export interface Recommendation {
  placeId: string;
  placeName: string;
  /** Hinglish reason (Hindi + English mix). */
  reason: string;
  /** Match score 0-100 reflecting fit for the user's disability profile. */
  matchScore: number;
}

/** Top-N output from the recommendation agent. */
export interface RecommendationOutput {
  recommendations: Recommendation[];
}

/**
 * User-provided accessibility checklist values that override or supplement
 * the vision agent's automatic detections. Every field is optional — the user
 * only fills in what they explicitly verified.
 */
export type ManualAccessibilityChecklist = Partial<{
  hasRamp: boolean;
  hasElevator: boolean;
  hasBrailleSignage: boolean;
  hasSignLanguage: boolean;
  hasWideEntries: boolean;
  hasAccessibleParking: boolean;
  hasAccessibleRestroom: boolean;
  hasTactilePaving: boolean;
  hasQuietZone: boolean;
  noiseLevel: IntensityLevel;
  lightingLevel: IntensityLevel;
  crowdLevel: IntensityLevel;
}>;

/** Input to `orchestrator.handlePostCreation`. */
export interface PostCreationInput {
  user: User;
  placeId: string;
  placeName: string;
  placeType: string;
  /** Local file uri (e.g. from expo-image-picker) for upload. */
  imageUri: string;
  /** Raw base64 of the same image used by the vision agent. */
  imageBase64: string;
  /** Free-form caption typed by the user. May be empty. */
  manualCaption: string;
  /** Manually-verified accessibility flags the user toggled in the post form. */
  manualChecklist: ManualAccessibilityChecklist;
  /** Optional upload-progress callback (0-100). */
  onProgress?: (percent: number) => void;
}

/** Output of `orchestrator.handlePostCreation`. */
export interface PostCreationResult {
  postId: string;
  imageUrl: string;
  analysis: AIAnalysis;
  caption: CaptionOutput;
  coinsAwarded: number;
  newBadges: Badge[];
}
