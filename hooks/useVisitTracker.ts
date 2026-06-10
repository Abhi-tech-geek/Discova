/**
 * Visit tracker.
 *
 * While the app is in the foreground, watches the user's location and:
 *   1. Detects the venue the user is currently AT (the nearest named place
 *      within ~200 m) and remembers it as a "pending visit".
 *   2. When the user later moves ≥3 km away from that venue, promotes the
 *      pending visit to a "review nudge" so the app can ask them to rate the
 *      place's accessibility.
 *
 * State lives in `visitStore` (persisted), so a visit detected before the app
 * was closed still fires a nudge the next time the app opens far enough away.
 *
 * This is a FOREGROUND implementation (works while the app is open, or on the
 * next open after the user has moved on). True app-closed background tracking
 * would need `ACCESS_BACKGROUND_LOCATION` + a TaskManager geofence and is a
 * follow-up. Every location/Google call is wrapped so failures are silent.
 */

import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

import { calculateDistanceKm, getNearbyPlaces } from '../services/googleMaps';
import { useUserStore } from '../stores/userStore';
import { useVisitStore } from '../stores/visitStore';
import type { GeoPoint } from '../types';

/** Distance from a venue that counts as "left" → triggers the review nudge. */
const LEAVE_RADIUS_KM = 3;
/** Max distance (metres) to the nearest place to count as "at" that venue. */
const AT_PLACE_RADIUS_M = 200;
/** Don't re-run venue detection more often than this. */
const DETECT_THROTTLE_MS = 3 * 60 * 1000;

/**
 * Mount-once hook (use it in the root layout). No-ops until the user is
 * authenticated and location permission is granted.
 */
export function useVisitTracker(): void {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const lastDetectRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    /** Handle a single location sample. */
    async function handle(coords: GeoPoint): Promise<void> {
      const store = useVisitStore.getState();

      // If we already have a nudge waiting, let the user resolve it first.
      if (store.reviewNudge) return;

      const pending = store.pendingVisit;
      if (pending) {
        // Already at/near a venue — check if the user has now left it.
        if (calculateDistanceKm(coords, pending.coords) >= LEAVE_RADIUS_KM) {
          store.promoteToNudge();
        }
        return;
      }

      // No pending visit — try to detect the venue the user is standing at.
      const now = Date.now();
      if (now - lastDetectRef.current < DETECT_THROTTLE_MS) return;
      lastDetectRef.current = now;

      try {
        const nearby = await getNearbyPlaces(coords, 150, '', '');
        if (cancelled || nearby.length === 0) return;

        // Pick the physically nearest result.
        let best = nearby[0];
        let bestKm = calculateDistanceKm(coords, best.location);
        for (const np of nearby) {
          const km = calculateDistanceKm(coords, np.location);
          if (km < bestKm) {
            best = np;
            bestKm = km;
          }
        }
        if (bestKm * 1000 > AT_PLACE_RADIUS_M) return;

        // Skip venues we've already nudged about.
        const key = best.placeId.length > 0 ? best.placeId : best.name;
        if (store.dismissedPlaceIds.includes(key)) return;

        store.setPendingVisit({
          placeId: best.placeId,
          name: best.name,
          city: '',
          coords: best.location,
          enteredAt: now,
        });
      } catch {
        /* detection is best-effort */
      }
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60_000,
            distanceInterval: 120,
          },
          (loc) => {
            void handle({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          },
        );
      } catch {
        /* location optional — feature simply stays idle */
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [isAuthenticated]);
}
