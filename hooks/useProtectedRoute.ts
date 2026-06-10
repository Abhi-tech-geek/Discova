/**
 * Protected-route hook.
 * Reads `isAuthenticated` from the user store and routes the user away from
 * the wrong group:
 *   - Not authenticated AND not in `auth/` → redirect to `/auth/login`.
 *   - Authenticated AND currently in `auth/`  → redirect to `/(tabs)`.
 * Mount once in `app/_layout.tsx` — that single instance covers every route.
 */

import { useEffect, useState } from 'react';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';

import { useUserStore } from '../stores/userStore';

/**
 * Run the protected-route effect.
 * Returns the current flags so the caller can render a skeleton during the
 * brief moment between auth resolving and the redirect landing.
 */
export function useProtectedRoute(): { isAuthenticated: boolean; isLoading: boolean } {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const isLoading = useUserStore((s) => s.isLoading);
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // Defer all navigation to AFTER first paint. Navigating during the first
  // commit throws "Attempted to navigate before mounting the Root Layout".
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Need: component mounted past first paint + navigator ready + auth resolved.
    if (!isMounted) return;
    if (!navigationState?.key) return;
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isMounted, isAuthenticated, isLoading, segments, router, navigationState?.key]);

  return { isAuthenticated, isLoading };
}
