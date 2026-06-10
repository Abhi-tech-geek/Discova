import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { GeoPoint } from '../types';

/** A place the user was physically near (candidate for a review nudge). */
export interface Visit {
  /** Google place id (preferred) or the place name as a fallback key. */
  placeId: string;
  name: string;
  city: string;
  coords: GeoPoint;
  /** Epoch ms when the visit was first detected. */
  enteredAt: number;
}

/**
 * Tracks the user's current/last venue visit and the resulting "rate this
 * place" nudge. Persisted to AsyncStorage so a visit detected before the app
 * was closed can still fire a nudge the next time it opens (after the user has
 * moved away). Mutated by `useVisitTracker`; read by `ReviewNudge`.
 */
interface VisitState {
  /** Venue the user is currently at / recently was at (not yet nudged). */
  pendingVisit: Visit | null;
  /** Venue the user has now left by ≥3 km — show the review prompt. */
  reviewNudge: Visit | null;
  /** Place keys already nudged/dismissed, so we don't pester repeatedly. */
  dismissedPlaceIds: string[];

  /** Record that the user is now at `visit`. */
  setPendingVisit: (visit: Visit) => void;
  /** Forget the pending visit without nudging (e.g. it was invalid). */
  clearPendingVisit: () => void;
  /** Promote the pending visit to an active review nudge. */
  promoteToNudge: () => void;
  /** Dismiss the active nudge (user tapped "Later" or "Rate"). */
  resolveNudge: () => void;
}

/** Stable key used to de-dupe nudges for a venue. */
function visitKey(v: Visit): string {
  return v.placeId.length > 0 ? v.placeId : v.name;
}

export const useVisitStore = create<VisitState>()(
  persist(
    (set, get) => ({
      pendingVisit: null,
      reviewNudge: null,
      dismissedPlaceIds: [],

      setPendingVisit: (visit) => set({ pendingVisit: visit }),

      clearPendingVisit: () => set({ pendingVisit: null }),

      promoteToNudge: () => {
        const pending = get().pendingVisit;
        if (!pending) return;
        set({ reviewNudge: pending, pendingVisit: null });
      },

      resolveNudge: () => {
        const nudge = get().reviewNudge;
        if (!nudge) {
          set({ reviewNudge: null });
          return;
        }
        // Keep the last 50 dismissed keys so we never re-nudge the same venue.
        const next = [...get().dismissedPlaceIds, visitKey(nudge)].slice(-50);
        set({ reviewNudge: null, dismissedPlaceIds: next });
      },
    }),
    {
      name: 'discova.visits',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        pendingVisit: s.pendingVisit,
        reviewNudge: s.reviewNudge,
        dismissedPlaceIds: s.dismissedPlaceIds,
      }),
    },
  ),
);
