import { create } from 'zustand';
import type { DisabilityType, ThemeMode } from '../types';

/**
 * Filter applied to the explore/search feeds.
 * - 'all' shows everything,
 * - DisabilityType values narrow by category (mobility / visual / hearing / cognitive / sensory),
 * - 'senior' is a UI-level convenience filter (good overall accessibility).
 */
export type FeedFilter = 'all' | DisabilityType | 'senior';

/** Shape of the global app store: theme + explore UI state. */
interface AppState {
  theme: ThemeMode;
  activeFilter: FeedFilter;
  currentCity: string;
  isMapView: boolean;

  /** Explicitly set the theme. */
  setTheme: (theme: ThemeMode) => void;
  /** Flip between light and dark themes. */
  toggleTheme: () => void;
  /** Apply a disability filter (or 'all') to the explore feed. */
  setFilter: (filter: FeedFilter) => void;
  /** Set the current city used to scope nearby queries. */
  setCity: (city: string) => void;
  /** Flip between map and list view on the explore screen. */
  toggleMapView: () => void;
  /** Explicitly set map vs. list view. */
  setMapView: (isMapView: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'light',
  activeFilter: 'all',
  currentCity: '',
  isMapView: false,

  /** Replace the active theme. */
  setTheme: (theme) => set({ theme }),

  /** Toggle between 'light' and 'dark'. */
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  /** Set the active feed filter. */
  setFilter: (filter) => set({ activeFilter: filter }),

  /** Set the current city. */
  setCity: (city) => set({ currentCity: city }),

  /** Invert the map/list view flag. */
  toggleMapView: () => set((state) => ({ isMapView: !state.isMapView })),

  /** Explicitly set the map/list view flag. */
  setMapView: (isMapView) => set({ isMapView }),
}));
