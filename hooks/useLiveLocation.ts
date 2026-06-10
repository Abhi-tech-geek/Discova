/**
 * Live-location hook.
 *
 * Requests foreground location permission once, then resolves the device
 * location in TWO stages for speed:
 *   1. `getLastKnownPositionAsync()` — the OS's cached fix, returned almost
 *      instantly (no GPS hardware wait). Lets dependent screens start fetching
 *      nearby places immediately instead of staring at a "Locating…" spinner.
 *   2. `getCurrentPositionAsync()` — a fresh fix in the background; the location
 *      is only upgraded if the device has actually moved a meaningful distance,
 *      so we don't trigger a redundant nearby-places refetch.
 *
 * Coordinates are reverse-geocoded to a "Sector 99A, Gurugram" label using the
 * OS geocoder (`expo-location`'s `reverseGeocodeAsync` — no Google key, free).
 *
 * The resolved label is mirrored into `appStore.currentCity` so other screens
 * can read it without re-running the permission flow.
 */

import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { useAppStore } from '../stores/appStore';
import type { GeoPoint } from '../types';

/** Status of the location resolution. */
export type LocationStatus = 'loading' | 'granted' | 'denied';

export interface LiveLocation {
  location: GeoPoint | null;
  /** City / town, e.g. "Gurugram". */
  city: string;
  /** Sub-locality / sector, e.g. "Sector 99A". */
  area: string;
  /** Combined display label, e.g. "Sector 99A, Gurugram". */
  label: string;
  status: LocationStatus;
}

/** ~0.001° latitude ≈ 110 m. Below this we treat two fixes as the "same spot"
 *  and skip the upgrade so dependent effects don't refetch needlessly. */
const SAME_SPOT_DELTA = 0.001;

/** True if two points are far enough apart to be worth re-fetching for. */
function movedEnough(a: GeoPoint, b: GeoPoint): boolean {
  return (
    Math.abs(a.latitude - b.latitude) > SAME_SPOT_DELTA ||
    Math.abs(a.longitude - b.longitude) > SAME_SPOT_DELTA
  );
}

/**
 * Resolve the device's current location + a precise area label (sector + city).
 * Re-runs whenever the hook mounts, so moving to a new place + reopening a
 * screen picks up the new location.
 */
export function useLiveLocation(): LiveLocation {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [city, setCity] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [status, setStatus] = useState<LocationStatus>('loading');
  const setCityStore = useAppStore((s) => s.setCity);

  useEffect(() => {
    let cancelled = false;

    /** Reverse-geocode a point → city / area / label (best-effort, never throws). */
    const resolveLabel = async (point: GeoPoint) => {
      try {
        const places = await Location.reverseGeocodeAsync(point);
        if (cancelled) return;
        const top = places[0];
        const cityName = top?.city || top?.region || top?.subregion || '';
        const areaName =
          top?.district || top?.name || top?.street || top?.subregion || '';
        const combined =
          areaName && areaName !== cityName
            ? `${areaName}, ${cityName}`.replace(/, $/, '')
            : cityName;

        if (cityName.length > 0) setCity(cityName);
        if (areaName.length > 0) setArea(areaName);
        if (combined.length > 0) {
          setLabel(combined);
          setCityStore(combined);
        }
      } catch {
        /* reverse geocode optional — coords still usable */
      }
    };

    (async () => {
      try {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm !== 'granted') {
          setStatus('denied');
          return;
        }

        let known: GeoPoint | null = null;

        // STAGE 1 — instant: last cached fix (no GPS wait). Render places ASAP.
        try {
          const last = await Location.getLastKnownPositionAsync({
            maxAge: 5 * 60 * 1000, // accept a fix up to 5 min old
          });
          if (last && !cancelled) {
            known = { latitude: last.coords.latitude, longitude: last.coords.longitude };
            setLocation(known);
            setStatus('granted');
            void resolveLabel(known);
          }
        } catch {
          /* no cached fix — fall through to a fresh one */
        }

        // STAGE 2 — refine: fresh fix in the background.
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const point: GeoPoint = {
          latitude: fresh.coords.latitude,
          longitude: fresh.coords.longitude,
        };
        setStatus('granted');
        // Only upgrade if we had no cached fix, or the device actually moved —
        // otherwise the cached fix is already good and a re-set would refetch.
        if (!known || movedEnough(known, point)) {
          setLocation(point);
          void resolveLabel(point);
        }
      } catch {
        // Fresh fix failed: keep any cached fix we already showed, else denied.
        if (!cancelled) setStatus((s) => (s === 'granted' ? s : 'denied'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setCityStore]);

  return { location, city, area, label, status };
}
