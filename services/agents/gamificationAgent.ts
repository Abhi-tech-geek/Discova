/**
 * Gamification Agent.
 * Pure-TypeScript rules — no AI. Owns the coins table, multipliers, and the
 * badge-qualification logic, and delegates persistence to the firebase service.
 */

import { addCoinsToUser } from '../firebase';
import type {
  Badge,
  BadgeRarity,
  CoinTransactionAction,
  EarnedBadge,
  User,
} from '../../types';

/* -------------------------------------------------------------------------- */
/*  Coin economy                                                              */
/* -------------------------------------------------------------------------- */

/** Base coin reward for every action type. Multipliers are applied on top. */
export const COINS_TABLE: Record<CoinTransactionAction, number> = {
  post_created: 10,
  review_created: 20,
  place_added: 50,
  badge_earned: 100,
  reward_redeemed: 0,
  daily_bonus: 5,
  level_up: 25,
  adjustment: 0,
};

const PWD_MULTIPLIER = 2;
const STREAK_THRESHOLD_DAYS = 21;
const STREAK_MULTIPLIER = 1.5;

/**
 * Compute the final coin amount for a user + action, applying PWD mode and
 * streak multipliers on top of the base value in `COINS_TABLE`.
 */
export function calculateCoins(user: User, action: CoinTransactionAction): number {
  const base = COINS_TABLE[action];
  if (base === 0) return 0;
  let multiplier = 1;
  if (user.pwdMode) multiplier *= PWD_MULTIPLIER;
  if (user.streak >= STREAK_THRESHOLD_DAYS) multiplier *= STREAK_MULTIPLIER;
  return Math.floor(base * multiplier);
}

/* -------------------------------------------------------------------------- */
/*  Badge catalog                                                             */
/* -------------------------------------------------------------------------- */

/** Catalog row plus the predicate that decides if a user qualifies. */
interface BadgeRule {
  badge: Badge;
  qualifies: (user: User) => boolean;
}

/** Build a Badge catalog entry. */
function badge(
  id: string,
  name: string,
  description: string,
  icon: string,
  rarity: BadgeRarity,
  requirement: string,
  coinReward: number,
): Badge {
  return { id, name, description, icon, rarity, requirement, coinReward };
}

const BADGE_RULES: readonly BadgeRule[] = [
  {
    badge: badge(
      'first_post',
      'First Steps',
      'Shared your first accessibility post.',
      '👣',
      'common',
      'Create 1 post',
      50,
    ),
    qualifies: (u) => u.stats.postsCount >= 1,
  },
  {
    badge: badge(
      'explorer_10',
      'Explorer',
      'Shared 10 accessibility posts.',
      '🧭',
      'rare',
      'Create 10 posts',
      150,
    ),
    qualifies: (u) => u.stats.postsCount >= 10,
  },
  {
    badge: badge(
      'trailblazer_50',
      'Trailblazer',
      'Shared 50 accessibility posts.',
      '🔥',
      'epic',
      'Create 50 posts',
      500,
    ),
    qualifies: (u) => u.stats.postsCount >= 50,
  },
  {
    badge: badge(
      'reviewer_5',
      'Helpful Voice',
      'Wrote 5 detailed reviews.',
      '🗣️',
      'common',
      'Write 5 reviews',
      75,
    ),
    qualifies: (u) => u.stats.reviewsCount >= 5,
  },
  {
    badge: badge(
      'pioneer_5',
      'Pioneer',
      'Added 5 new places to Discova.',
      '🌱',
      'rare',
      'Add 5 places',
      200,
    ),
    qualifies: (u) => u.stats.placesAdded >= 5,
  },
  {
    badge: badge(
      'streak_21',
      'Consistent',
      'Stayed active 21 days in a row.',
      '⚡',
      'epic',
      '21-day streak',
      300,
    ),
    qualifies: (u) => u.streak >= 21,
  },
  {
    badge: badge(
      'streak_100',
      'Devoted',
      'Stayed active 100 days in a row.',
      '🏆',
      'legendary',
      '100-day streak',
      1000,
    ),
    qualifies: (u) => u.streak >= 100,
  },
  {
    badge: badge(
      'inclusive_ally',
      'Inclusive Ally',
      'Posted with PWD mode on.',
      '🤝',
      'rare',
      'Post in PWD mode',
      150,
    ),
    qualifies: (u) => u.pwdMode && u.stats.postsCount >= 1,
  },
];

/* -------------------------------------------------------------------------- */
/*  Agent                                                                     */
/* -------------------------------------------------------------------------- */

/** Convert a Badge to the lightweight `EarnedBadge` reference stored on User. */
function toEarnedBadge(b: Badge, now: number = Date.now()): EarnedBadge {
  return { badgeId: b.id, earnedAt: now };
}

export const gamificationAgent = {
  name: 'GamificationAgent' as const,
  COINS_TABLE,
  calculateCoins,

  /**
   * Award the configured coin amount for `action` to `user`.
   * Applies PWD (2x) and streak (1.5x at 21+ days) multipliers, then writes
   * via `firebase.addCoinsToUser` (which also appends a ledger row).
   * @returns The final coin amount awarded (after multipliers).
   */
  async awardCoins(user: User, action: CoinTransactionAction): Promise<number> {
    const amount = calculateCoins(user, action);
    if (amount === 0) return 0;
    await addCoinsToUser(user.uid, amount, action);
    return amount;
  },

  /**
   * Return every badge the user currently qualifies for but has not yet earned.
   * Pure function — does NOT persist anything; callers decide when to award.
   */
  checkBadgeEarned(user: User): Badge[] {
    const owned = new Set(user.badges.map((b) => b.badgeId));
    const earned: Badge[] = [];
    for (const rule of BADGE_RULES) {
      if (owned.has(rule.badge.id)) continue;
      if (rule.qualifies(user)) earned.push(rule.badge);
    }
    return earned;
  },

  toEarnedBadge,
};
