/**
 * Theme hook.
 * Bridges the Zustand `appStore` theme value with `expo-secure-store` persistence
 * so the user's choice survives app restarts.
 */

import { useCallback, useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { colorScheme as nativewindColorScheme } from 'nativewind';

import { useAppStore } from '../stores/appStore';
import type { ThemeMode } from '../types';

const THEME_KEY = 'discova.theme';

/** Type guard for the two valid theme values. */
function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

/**
 * Subscribe to the current theme and expose a toggle helper.
 * On mount, restores the persisted choice from SecureStore (if any).
 * On every toggle, writes the new value back to SecureStore.
 */
export function useTheme(): {
  colorScheme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
} {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;
    SecureStore.getItemAsync(THEME_KEY)
      .then((stored) => {
        if (isThemeMode(stored)) setTheme(stored);
      })
      .catch(() => {
        /* ignore — first launch or SecureStore unavailable */
      });
  }, [setTheme]);

  // Keep NativeWind's runtime color scheme in sync with the store so every
  // `dark:` variant resolves regardless of which View carries the `dark` class.
  useEffect(() => {
    nativewindColorScheme.set(theme);
  }, [theme]);

  /** Flip light/dark and persist the new value. */
  const toggleTheme = useCallback(() => {
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    SecureStore.setItemAsync(THEME_KEY, next).catch(() => {
      /* ignore — write best-effort */
    });
  }, [theme, setTheme]);

  return {
    colorScheme: theme,
    isDark: theme === 'dark',
    toggleTheme,
  };
}
