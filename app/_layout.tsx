import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ReviewNudge } from '../components/ReviewNudge';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useTheme } from '../hooks/useTheme';
import { useVisitTracker } from '../hooks/useVisitTracker';
import { getUserProfile, onAuthChange } from '../services/firebase';
import { createDemoUser, useUserStore } from '../stores/userStore';

/**
 * Full-screen overlay spinner shown while the auth state is being restored on
 * cold start. Rendered *on top of* the navigator (not instead of it) so
 * expo-router always has a mounted Stack on the very first render.
 */
function AuthLoadingOverlay({ isDark }: { isDark: boolean }) {
  return (
    <View
      testID="root_auth_loading"
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      className={`items-center justify-center bg-surface-light dark:bg-surface-dark ${
        isDark ? 'dark' : ''
      }`}
    >
      <ActivityIndicator size="large" color="#2E6BFF" />
      <Text className="mt-3 text-sm text-gray-500 dark:text-gray-400">
        Loading Discova…
      </Text>
    </View>
  );
}

/**
 * Root layout for the expo-router tree.
 * Owns:
 *  - one-time global.css side-effect import,
 *  - dark/light root wrapper (applies the `dark` class for NativeWind),
 *  - Firebase auth listener that hydrates the Zustand user store,
 *  - the protected-route redirect logic,
 *  - the top-level Stack navigator (always mounted on first render).
 */
export default function RootLayout() {
  const { isDark } = useTheme();
  const setUser = useUserStore((s) => s.setUser);
  const setLoading = useUserStore((s) => s.setLoading);
  const [authChecked, setAuthChecked] = useState(false);

  // Subscribe to Firebase auth state once. The cleanup returned by
  // `onAuthChange` is invoked when the layout unmounts (effectively, app exit).
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Build a safe fallback so a signed-in user (esp. anonymous/guest) is
        // NEVER bounced to login just because their Firestore profile is
        // missing or unreadable — the Firebase session itself persists.
        const fallback = createDemoUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? 'guest@discova.app',
        });
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          setUser(profile ?? fallback);
        } catch {
          setUser(fallback);
        }
      } else {
        setUser(null);
      }
      setAuthChecked(true);
      setLoading(false);
    });
    return unsubscribe;
  }, [setUser, setLoading]);

  // Mounting the protected-route hook here covers every screen under app/.
  // It no-ops until the navigator is ready + auth has resolved.
  useProtectedRoute();

  // Track venue visits → nudge the user to review a place after they leave it.
  useVisitTracker();

  // IMPORTANT: the <Stack> must render on the FIRST render so expo-router has a
  // mounted navigator before any redirect fires. The loading state is an
  // overlay on top, never a replacement for the navigator.
  return (
    <SafeAreaProvider>
      <View
        testID="root_layout"
        className={`flex-1 bg-surface-light dark:bg-surface-dark ${isDark ? 'dark' : ''}`}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/onboarding" />
          <Stack.Screen
            name="place/[id]"
            options={{ presentation: 'card', animation: 'slide_from_right' }}
          />
          <Stack.Screen name="rewards/store" />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="review/[placeId]"
            options={{ presentation: 'card', animation: 'slide_from_right' }}
          />
          <Stack.Screen name="ask" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        {!authChecked ? <AuthLoadingOverlay isDark={isDark} /> : null}
        <ReviewNudge />
        <StatusBar style="auto" />
      </View>
    </SafeAreaProvider>
  );
}
