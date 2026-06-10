import { create } from 'zustand';
import type { DisabilityType, EarnedBadge, User } from '../types';

/**
 * Build a local demo user for testing without a configured Firebase backend.
 * Lets the app get past the auth gate so screens are reachable on-device.
 */
export function createDemoUser(overrides: Partial<User> = {}): User {
  const now = Date.now();
  // A fresh, BLANK profile — real new users start with nothing (no fake name,
  // coins, posts or stats). Name is derived from the email when available.
  const nameFromEmail =
    overrides.email && overrides.email.includes('@')
      ? overrides.email.split('@')[0]
      : 'Explorer';
  return {
    uid: `user_${now}`,
    email: 'guest@discova.app',
    displayName: nameFromEmail,
    photoURL: null,
    bio: '',
    dob: '',
    location: '',
    disabilityType: 'none',
    pwdMode: false,
    coins: 0,
    level: 1,
    badges: [],
    followers: 0,
    following: 0,
    joinedAt: now,
    streak: 0,
    lastActiveDate: now,
    stats: { postsCount: 0, reviewsCount: 0, placesAdded: 0, storiesCount: 0 },
    preferences: {
      pwdMode: false,
      notifications: true,
      preferredCategories: [],
      preferredRadiusKm: 7,
    },
    ...overrides,
  };
}

/** Shape of the user store: signed-in profile + auth status + mutators. */
interface UserState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  /** Replace the entire user profile. Passing `null` signs the user out. */
  setUser: (user: User | null) => void;
  /** Add `delta` to the user's coin balance (negative to spend). No-op if signed out. */
  updateCoins: (delta: number) => void;
  /** Flip PWD (person-with-disability) accessibility mode on the current user. */
  togglePWDMode: () => void;
  /** Persist the user's primary disability category (drives recommendations). */
  setDisabilityType: (type: DisabilityType) => void;
  /** Append an earned badge to the user's collection. */
  addBadge: (badge: EarnedBadge) => void;
  /** Toggle the global loading flag (e.g. while restoring session). */
  setLoading: (isLoading: boolean) => void;
  /** Clear user + auth flag. Use after Firebase signOut resolves. */
  signOut: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  /** Replace user and recompute auth flag from presence. */
  setUser: (user) => set({ user, isAuthenticated: user !== null }),

  /** Apply a coin delta to the current user; no change if no user is loaded. */
  updateCoins: (delta) =>
    set((state) =>
      state.user
        ? { user: { ...state.user, coins: state.user.coins + delta } }
        : {},
    ),

  /** Invert the user's `pwdMode` flag and mirror it into preferences. */
  togglePWDMode: () =>
    set((state) =>
      state.user
        ? {
            user: {
              ...state.user,
              pwdMode: !state.user.pwdMode,
              preferences: {
                ...state.user.preferences,
                pwdMode: !state.user.pwdMode,
              },
            },
          }
        : {},
    ),

  /** Set the disability category used by the recommendation agent. */
  setDisabilityType: (type) =>
    set((state) =>
      state.user ? { user: { ...state.user, disabilityType: type } } : {},
    ),

  /** Append a badge if not already earned, identified by `badgeId`. */
  addBadge: (badge) =>
    set((state) => {
      if (!state.user) return {};
      const already = state.user.badges.some((b) => b.badgeId === badge.badgeId);
      if (already) return {};
      return { user: { ...state.user, badges: [...state.user.badges, badge] } };
    }),

  /** Set the loading flag (true while session restore / auth in flight). */
  setLoading: (isLoading) => set({ isLoading }),

  /** Reset the entire store to the signed-out state. */
  signOut: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}));
