import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceCard } from '../../components/PlaceCard';
import { GradientAvatar } from '../../components/design/GradientAvatar';
import { COLORS } from '../../components/design/theme';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import {
  getNearbyAttractions,
  getPlaceDetails,
  nearbyToPlace,
  searchPlaces,
  type PlaceAutocompleteResult,
} from '../../services/googleMaps';
import type { Place } from '../../types';

/** True when an autocomplete result is an area (locality/city/region), not a
 *  single business — so we show places IN it instead of opening one page. */
function isAreaPrediction(types: string[]): boolean {
  if (types.includes('establishment') || types.includes('point_of_interest')) return false;
  return types.some((t) =>
    /(locality|sublocality|administrative_area|postal_code|neighborhood|political)/.test(t),
  );
}

/* -------------------------------------------------------------------------- */
/*  Seed data (users only — places are now real Google results)               */
/* -------------------------------------------------------------------------- */

const RECENTS_KEY = 'discova.search.recents';
const MAX_RECENTS = 8;

interface SearchUser {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
}

const SEED_USERS: SearchUser[] = [
  { uid: 'u1', displayName: 'Priya Sharma', photoURL: 'https://i.pravatar.cc/150?img=47', bio: 'Accessibility advocate · Delhi' },
  { uid: 'u2', displayName: 'Arjun Mehta', photoURL: 'https://i.pravatar.cc/150?img=12', bio: 'Wheelchair traveller · Mumbai' },
  { uid: 'u3', displayName: 'Neha Kapoor', photoURL: 'https://i.pravatar.cc/150?img=32', bio: 'Travel writer · Bangalore' },
  { uid: 'u4', displayName: 'Rahul Singh', photoURL: 'https://i.pravatar.cc/150?img=15', bio: 'Inclusive design · Gurgaon' },
  { uid: 'u5', displayName: 'Sana Khan', photoURL: 'https://i.pravatar.cc/150?img=25', bio: 'Mom of 2 · Delhi' },
];

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                      */
/* -------------------------------------------------------------------------- */

type Tab = 'places' | 'users';

const TABS: Array<{ key: Tab; label: string; testID: string }> = [
  { key: 'places', label: 'Places', testID: 'search_tab_places' },
  { key: 'users', label: 'People', testID: 'search_tab_users' },
];

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

/** Recent-searches list / first-run hint. */
function RecentSearches({
  recents,
  onSelect,
  onClear,
}: {
  recents: string[];
  onSelect: (term: string) => void;
  onClear: () => void;
}) {
  if (recents.length === 0) {
    return (
      <View testID="search_recents_empty" className="items-center px-6 pt-10">
        <Text className="text-4xl">🔍</Text>
        <Text className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
          Search any place in India
        </Text>
        <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
          Malls, cafés, stations, offices — type a name and open it to see its
          accessibility.
        </Text>
      </View>
    );
  }

  return (
    <View testID="search_recents" className="px-4 pt-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Recent searches
        </Text>
        <Pressable
          testID="search_recents_clear"
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear recent searches"
          hitSlop={8}
        >
          <Text className="text-xs font-medium text-primary">Clear</Text>
        </Pressable>
      </View>
      {recents.map((term, i) => (
        <Pressable
          key={term}
          testID={`search_recent_${i}`}
          onPress={() => onSelect(term)}
          accessibilityRole="button"
          className="flex-row items-center border-b border-border-light py-3 dark:border-border-dark"
        >
          <Ionicons name="time-outline" size={16} color={COLORS.ink3} />
          <Text className="ml-3 flex-1 text-sm text-gray-900 dark:text-white">{term}</Text>
          <Ionicons name="arrow-up-outline" size={14} color={COLORS.ink3} style={{ transform: [{ rotate: '-45deg' }] }} />
        </Pressable>
      ))}
    </View>
  );
}

/** No-results empty state. */
function NoResults({ tab }: { tab: Tab }) {
  return (
    <View testID="search_empty_state" className="flex-1 items-center justify-center px-8">
      <Text className="text-5xl">🪐</Text>
      <Text className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
        No {tab === 'places' ? 'places' : 'people'} found
      </Text>
      <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
        Try a different word{tab === 'places' ? ' or a fuller name' : ''}.
      </Text>
    </View>
  );
}

/** One Google autocomplete prediction row. */
function PlacePredictionRow({
  prediction,
  onPress,
  index,
}: {
  prediction: PlaceAutocompleteResult;
  onPress: () => void;
  index: number;
}) {
  return (
    <Pressable
      testID={`search_place_row_${index}`}
      onPress={onPress}
      accessibilityRole="button"
      className="mb-2 flex-row items-center rounded-2xl border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <Ionicons name="location" size={20} color={COLORS.brand} />
      </View>
      <View className="ml-3 flex-1">
        <Text numberOfLines={1} className="text-sm font-semibold text-gray-900 dark:text-white">
          {prediction.mainText}
        </Text>
        <Text numberOfLines={1} className="text-xs text-gray-500 dark:text-gray-400">
          {prediction.secondaryText}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.ink3} />
    </Pressable>
  );
}

/** Search result row for a user. */
function UserRow({ user, index }: { user: SearchUser; index: number }) {
  return (
    <Pressable
      testID={`search_user_row_${index}`}
      accessibilityRole="button"
      className="mb-2 flex-row items-center rounded-2xl border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <GradientAvatar name={user.displayName} photoURL={user.photoURL} seed={index} size={44} />
      <View className="ml-3 flex-1">
        <Text className="text-sm font-semibold text-gray-900 dark:text-white">{user.displayName}</Text>
        <Text numberOfLines={1} className="text-xs text-gray-500 dark:text-gray-400">{user.bio}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.ink3} />
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Search tab.
 * Places tab runs a debounced **Google Places autocomplete** (real results
 * across India); tapping a result opens the place detail (which then loads
 * Google + AI accessibility). People tab filters a small seed list.
 */
export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput | null>(null);
  const { location } = useLiveLocation();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('places');
  const [recents, setRecents] = useState<string[]>([]);
  const [predictions, setPredictions] = useState<PlaceAutocompleteResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [areaResults, setAreaResults] = useState<{ name: string; places: Place[] } | null>(null);
  const [areaLoading, setAreaLoading] = useState(false);

  const trimmedQuery = query.trim();

  // Hydrate recents on mount.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(RECENTS_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setRecents(parsed.filter((x): x is string => typeof x === 'string'));
          }
        } catch {
          /* corrupt — ignore */
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced Google autocomplete for the Places tab.
  useEffect(() => {
    if (activeTab !== 'places' || trimmedQuery.length < 2) {
      setPredictions([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const results = await searchPlaces(trimmedQuery, location ?? undefined);
        if (!cancelled) setPredictions(results);
      } catch {
        if (!cancelled) setPredictions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmedQuery, activeTab, location]);

  /** Persist a new recents list. */
  const persistRecents = useCallback(async (next: string[]) => {
    setRecents(next);
    try {
      await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      /* best-effort */
    }
  }, []);

  /** Push a term into recents (dedup, capped). */
  const remember = useCallback(
    async (term: string) => {
      const trimmed = term.trim();
      if (trimmed.length === 0) return;
      const next = [trimmed, ...recents.filter((r) => r !== trimmed)].slice(0, MAX_RECENTS);
      await persistRecents(next);
    },
    [recents, persistRecents],
  );

  const handleRecentSelect = useCallback((term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  }, []);

  const handleClearRecents = useCallback(async () => {
    setRecents([]);
    try {
      await AsyncStorage.removeItem(RECENTS_KEY);
    } catch {
      /* best-effort */
    }
  }, []);

  /** Tap a prediction: if it's an AREA, show good places in it; else open the
   *  place detail. */
  const handleOpenPlace = useCallback(
    async (p: PlaceAutocompleteResult) => {
      void remember(p.mainText);
      Keyboard.dismiss();
      if (!isAreaPrediction(p.types)) {
        router.push({ pathname: '/place/[id]', params: { id: p.placeId } });
        return;
      }
      // Area → fetch the area's coords, then good places around it.
      setAreaLoading(true);
      setAreaResults({ name: p.mainText, places: [] });
      try {
        const details = await getPlaceDetails(p.placeId);
        if (details) {
          const near = await getNearbyAttractions(details.location, 7000);
          setAreaResults({ name: p.mainText, places: near.map((np) => nearbyToPlace(np, p.mainText)) });
        }
      } catch {
        /* keep empty → shows "none found" */
      } finally {
        setAreaLoading(false);
      }
    },
    [remember, router],
  );

  const userResults = useMemo<SearchUser[]>(() => {
    const q = trimmedQuery.toLowerCase();
    if (q.length === 0) return [];
    return SEED_USERS.filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.bio.toLowerCase().includes(q),
    );
  }, [trimmedQuery]);

  /** Body for the active tab. */
  const renderBody = () => {
    // Area view — list of good places inside a searched locality/city.
    if (areaResults) {
      return (
        <View className="flex-1">
          <View className="flex-row items-center px-3 py-2">
            <Pressable
              testID="search_area_back"
              onPress={() => setAreaResults(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back to search"
              className="h-9 w-9 items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark"
            >
              <Ionicons name="arrow-back" size={18} color={COLORS.ink3} />
            </Pressable>
            <Text numberOfLines={1} className="ml-2 flex-1 text-sm font-bold text-gray-900 dark:text-white">
              Places in {areaResults.name}
            </Text>
          </View>
          {areaLoading && areaResults.places.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={COLORS.brand} />
              <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">Finding places…</Text>
            </View>
          ) : (
            <FlatList
              testID="search_area_results"
              data={areaResults.places}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <PlaceCard
                  place={item}
                  index={index}
                  onPress={() => router.push({ pathname: '/place/[id]', params: { id: item.id } })}
                />
              )}
              contentContainerStyle={{ padding: 12 }}
              ListEmptyComponent={
                <Text className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  No top-rated places found in this area.
                </Text>
              }
            />
          )}
        </View>
      );
    }

    if (trimmedQuery.length === 0) {
      return (
        <RecentSearches recents={recents} onSelect={handleRecentSelect} onClear={handleClearRecents} />
      );
    }

    if (activeTab === 'places') {
      if (searching && predictions.length === 0) {
        return (
          <View testID="search_loading" className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={COLORS.brand} />
            <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">Searching…</Text>
          </View>
        );
      }
      if (predictions.length === 0) {
        return trimmedQuery.length < 2 ? null : <NoResults tab="places" />;
      }
      return (
        <FlatList
          testID="search_results_places"
          data={predictions}
          keyExtractor={(item) => item.placeId}
          renderItem={({ item, index }) => (
            <PlacePredictionRow prediction={item} index={index} onPress={() => handleOpenPlace(item)} />
          )}
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="handled"
        />
      );
    }

    if (userResults.length === 0) return <NoResults tab="users" />;
    return (
      <FlatList
        testID="search_results_users"
        data={userResults}
        keyExtractor={(item) => item.uid}
        renderItem={({ item, index }) => <UserRow user={item} index={index} />}
        contentContainerStyle={{ padding: 12 }}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  return (
    <SafeAreaView
      testID="search_screen"
      edges={['top']}
      className="flex-1 bg-surface-light dark:bg-surface-dark"
    >
      {/* Search bar */}
      <View className="px-4 pt-2">
        <View className="flex-row items-center rounded-2xl bg-muted-light px-3 py-2 dark:bg-muted-dark">
          <Ionicons name="search" size={18} color={COLORS.ink3} />
          <TextInput
            ref={inputRef}
            testID="search_input"
            value={query}
            onChangeText={setQuery}
            placeholder="Search places, people"
            placeholderTextColor="#9CA3AF"
            autoFocus
            returnKeyType="search"
            className="ml-2 flex-1 text-sm text-gray-900 dark:text-white"
          />
          {searching ? <ActivityIndicator size="small" color={COLORS.brand} /> : null}
          {query.length > 0 ? (
            <Pressable
              testID="search_clear_input"
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              className="ml-1"
            >
              <Ionicons name="close-circle" size={16} color={COLORS.ink3} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Tabs */}
      <View testID="search_tabs" className="mt-3 flex-row border-b border-border-light dark:border-border-dark">
        {TABS.map((t) => {
          const selected = activeTab === t.key;
          return (
            <Pressable
              key={t.key}
              testID={t.testID}
              onPress={() => setActiveTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={`flex-1 items-center py-2.5 ${selected ? 'border-b-2 border-primary' : ''}`}
            >
              <Text className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Body */}
      <View className="flex-1">{renderBody()}</View>
    </SafeAreaView>
  );
}
