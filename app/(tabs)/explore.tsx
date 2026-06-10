import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccessibilityBadge } from '../../components/AccessibilityBadge';
import { MapView, Marker, PROVIDER_GOOGLE } from '../../components/design/NativeMap';
import { PlaceCard } from '../../components/PlaceCard';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import {
  getNearbyAttractions,
  getNearbyPlaces,
  nearbyToPlace,
} from '../../services/googleMaps';
import { useAppStore, type FeedFilter } from '../../stores/appStore';
import type { Place } from '../../types';

const DELHI_REGION = {
  latitude: 28.6,
  longitude: 77.2,
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};



/* -------------------------------------------------------------------------- */
/*  Filters                                                                   */
/* -------------------------------------------------------------------------- */

interface ChipDef {
  filter: FeedFilter;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const CHIPS: ChipDef[] = [
  { filter: 'all', label: 'All', icon: 'earth' },
  { filter: 'mobility', label: 'Wheelchair', icon: 'wheelchair' },
  { filter: 'visual', label: 'Visual', icon: 'eye-off-outline' },
  { filter: 'hearing', label: 'Hearing', icon: 'ear-hearing' },
  { filter: 'senior', label: 'Senior', icon: 'walk' },
];

/** Apply the active filter to the seed place list. */
function applyFilter(places: Place[], filter: FeedFilter): Place[] {
  if (filter === 'all') return places;
  if (filter === 'senior') return places.filter((p) => p.accessibilityScores.overall >= 60);
  if (filter === 'mobility') return places.filter((p) => p.accessibilityScores.mobility >= 50);
  if (filter === 'visual') return places.filter((p) => p.accessibilityScores.visual >= 50);
  if (filter === 'hearing') return places.filter((p) => p.accessibilityScores.hearing >= 50);
  if (filter === 'cognitive') return places.filter((p) => p.accessibilityScores.cognitive >= 50);
  if (filter === 'sensory') return places.filter((p) => p.accessibilityScores.sensory >= 50);
  return places;
}

/* -------------------------------------------------------------------------- */
/*  Category filter (what KIND of place to fetch from Google)                 */
/* -------------------------------------------------------------------------- */

interface CategoryDef {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Google Places `type` ('' = curated attractions mix). */
  type: string;
  /** Google Places `keyword` (used for societies / residential). */
  keyword: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'all', label: 'Top picks', icon: 'star-outline', type: '', keyword: '' },
  { key: 'cafe', label: 'Cafés', icon: 'coffee', type: 'cafe', keyword: '' },
  { key: 'food', label: 'Food', icon: 'silverware-fork-knife', type: 'restaurant', keyword: '' },
  { key: 'park', label: 'Parks', icon: 'tree', type: 'park', keyword: '' },
  { key: 'mall', label: 'Malls', icon: 'shopping', type: 'shopping_mall', keyword: '' },
  { key: 'tourist', label: 'Tourist', icon: 'camera-outline', type: 'tourist_attraction', keyword: '' },
  { key: 'society', label: 'Societies', icon: 'home-city-outline', type: '', keyword: 'society' },
];

/** Horizontal category-chip row — picks WHAT kind of place to load. */
function CategoryChipsRow({
  activeKey,
  onChange,
}: {
  activeKey: string;
  onChange: (cat: CategoryDef) => void;
}) {
  return (
    <ScrollView
      testID="explore_category_chips"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
      className="border-b border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark"
    >
      {CATEGORIES.map((cat) => {
        const isActive = activeKey === cat.key;
        return (
          <Pressable
            key={cat.key}
            testID={`explore_category_chip_${cat.key}`}
            onPress={() => onChange(cat)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            className={`mr-2 h-8 flex-row items-center rounded-full px-3 ${
              isActive ? 'bg-brand-2' : 'bg-muted-light dark:bg-muted-dark'
            }`}
          >
            <MaterialCommunityIcons
              name={cat.icon}
              size={13}
              color={isActive ? '#FFFFFF' : '#6B7280'}
            />
            <Text
              className={`ml-1.5 text-xs font-semibold ${
                isActive ? 'text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/*  Marker helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Pick a marker fill class for a 0-10 score per spec (>7 green, 4-7 yellow, <4 red). */
function markerColorClass(scoreOutOf10: number): string {
  if (scoreOutOf10 >= 7) return 'bg-success';
  if (scoreOutOf10 >= 4) return 'bg-warning';
  return 'bg-danger';
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

/** Top filter-chip row. Single source of truth lives in appStore. */
function FilterChipsRow({
  activeFilter,
  onChange,
}: {
  activeFilter: FeedFilter;
  onChange: (filter: FeedFilter) => void;
}) {
  return (
    <ScrollView
      testID="explore_filter_chips"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
      className="border-b border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark"
    >
      {CHIPS.map((chip) => {
        const isActive = activeFilter === chip.filter;
        return (
          <Pressable
            key={chip.filter}
            testID={`explore_filter_chip_${chip.filter}`}
            onPress={() => onChange(chip.filter)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            className={`mr-2 h-9 flex-row items-center rounded-full px-3 ${
              isActive
                ? 'bg-primary'
                : 'bg-muted-light dark:bg-muted-dark'
            }`}
          >
            <MaterialCommunityIcons
              name={chip.icon}
              size={14}
              color={isActive ? '#FFFFFF' : '#6B7280'}
            />
            <Text
              className={`ml-1.5 text-sm font-medium ${
                isActive ? 'text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Reanimated bottom sheet shown on marker tap. */
function PlaceBottomSheet({
  place,
  onClose,
  onViewDetails,
  onGetRoute,
}: {
  place: Place | null;
  onClose: () => void;
  onViewDetails: (place: Place) => void;
  onGetRoute: (place: Place) => void;
}) {
  const translateY = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (place) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(400, { duration: 220 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [place, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!place) return null;

  const score = place.accessibilityScores.overall / 10;

  return (
    <>
      <Animated.View
        pointerEvents={place ? 'auto' : 'none'}
        style={backdropStyle}
        className="absolute inset-0 bg-black/30"
      >
        <Pressable
          testID="explore_bottom_sheet_backdrop"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close place sheet"
          className="flex-1"
        />
      </Animated.View>

      <Animated.View
        testID="explore_bottom_sheet"
        style={sheetStyle}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-border-light bg-surface-light px-5 pb-6 pt-3 dark:border-border-dark dark:bg-surface-dark"
      >
        <View className="mb-3 self-center h-1.5 w-12 rounded-full bg-muted-light dark:bg-muted-dark" />

        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text
              numberOfLines={1}
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {place.name}
            </Text>
            <Text
              numberOfLines={2}
              className="mt-0.5 text-sm text-gray-500 dark:text-gray-400"
            >
              {place.address}
            </Text>
          </View>
          <AccessibilityBadge score={score} size="md" />
        </View>

        <View className="mt-4 flex-row">
          <Pressable
            testID="explore_bottom_sheet_details"
            onPress={() => onViewDetails(place)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${place.name} details`}
            className="mr-2 h-12 flex-1 flex-row items-center justify-center rounded-xl bg-primary"
          >
            <Ionicons name="information-circle-outline" size={18} color="#FFFFFF" />
            <Text className="ml-2 text-sm font-semibold text-white">View Details</Text>
          </Pressable>
          <Pressable
            testID="explore_bottom_sheet_route"
            onPress={() => onGetRoute(place)}
            accessibilityRole="button"
            accessibilityLabel={`Get directions to ${place.name}`}
            className="ml-2 h-12 flex-1 flex-row items-center justify-center rounded-xl border border-primary bg-surface-light dark:bg-surface-dark"
          >
            <Ionicons name="navigate" size={18} color="#6366F1" />
            <Text className="ml-2 text-sm font-semibold text-primary">Get Route</Text>
          </Pressable>
        </View>
      </Animated.View>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Explore screen: filter chips + map (60%) + horizontal card rail (40%),
 * with a Reanimated bottom sheet for any tapped marker. Toggle to a list view.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const activeFilter = useAppStore((s) => s.activeFilter);
  const setFilter = useAppStore((s) => s.setFilter);
  const isMapView = useAppStore((s) => s.isMapView);
  const toggleMapView = useAppStore((s) => s.toggleMapView);

  const mapRef = useRef<MapView | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  // Live location + reverse-geocoded city (writes appStore.currentCity).
  const { location: userLocation, city, label: locationLabel, status: locationStatus } =
    useLiveLocation();
  const locationDenied = locationStatus === 'denied';

  // City is only used to label the fetched places; keep it in a ref so the
  // reverse-geocode resolving (city '' → "Gurugram") does NOT re-trigger the
  // nearby-places fetch effect below (which would re-run 11 Google calls).
  const cityRef = useRef(city);
  cityRef.current = city;

  // Real Google "Nearby Search" results (rating ≥ 3.9, with photos). Empty
  // until the user's location resolves — we never show fake seed placeholders.
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  // Which KIND of place to fetch (Top picks / Cafés / Societies / etc.).
  const [category, setCategory] = useState<CategoryDef>(CATEGORIES[0]);

  // Fetch places when location resolves or the category changes (10 km radius).
  useEffect(() => {
    if (!userLocation) return;
    let cancelled = false;
    setLoadingNearby(true);
    (async () => {
      try {
        const isTopPicks = category.type === '' && category.keyword === '';
        const nearby = isTopPicks
          ? await getNearbyAttractions(userLocation, 7000)
          : await getNearbyPlaces(userLocation, 7000, category.keyword, category.type);
        if (cancelled) return;
        if (nearby.length > 0) {
          const resolvedCity = cityRef.current || 'Nearby';
          setPlaces(nearby.map((np) => nearbyToPlace(np, resolvedCity)));
        } else {
          setPlaces([]);
        }
      } finally {
        if (!cancelled) setLoadingNearby(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userLocation, category]);

  const filteredPlaces = useMemo(
    () => applyFilter(places, activeFilter),
    [places, activeFilter],
  );

  const initialRegion = useMemo(
    () =>
      userLocation
        ? {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }
        : DELHI_REGION,
    [userLocation],
  );

  /** Center the map on the user's current location (no-op if not yet resolved). */
  const handleMyLocation = useCallback(() => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion?.(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      500,
    );
  }, [userLocation]);

  const handleMarkerPress = useCallback(
    (place: Place) => {
      setSelectedPlace(place);
      mapRef.current?.animateToRegion(
        {
          latitude: place.location.latitude,
          longitude: place.location.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        },
        400,
      );
    },
    [],
  );

  const handleCloseSheet = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  const handleViewDetails = useCallback(
    (place: Place) => {
      setSelectedPlace(null);
      router.push(`/place/${place.id}`);
    },
    [router],
  );

  /** Open the platform's maps app for turn-by-turn directions. */
  const handleGetRoute = useCallback((place: Place) => {
    const { latitude, longitude } = place.location;
    const label = encodeURIComponent(place.name);
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${latitude},${longitude}&q=${label}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        /* user cancelled or no maps app installed */
      });
    }
  }, []);

  return (
    <SafeAreaView
      edges={['top']}
      className="flex-1 bg-surface-light dark:bg-surface-dark"
    >
      {/* Header */}
      <View
        testID="explore_header"
        className="flex-row items-center justify-between border-b border-border-light bg-surface-light px-4 py-2 dark:border-border-dark dark:bg-surface-dark"
      >
        <View>
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            Explore
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {locationDenied
              ? `Location off · ${filteredPlaces.length} places`
              : `${locationLabel || city || (loadingNearby ? 'Locating…' : 'Nearby')} · ${filteredPlaces.length} places`}
          </Text>
        </View>
        <Pressable
          testID="explore_toggle_view"
          onPress={toggleMapView}
          accessibilityRole="button"
          accessibilityLabel={isMapView ? 'Switch to list view' : 'Switch to map view'}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark"
        >
          <Ionicons
            name={isMapView ? 'list' : 'map'}
            size={20}
            className="text-gray-900 dark:text-white"
          />
        </Pressable>
      </View>

      <CategoryChipsRow activeKey={category.key} onChange={setCategory} />
      <FilterChipsRow activeFilter={activeFilter} onChange={setFilter} />

      {isMapView ? (
        <View className="flex-1">
          {/* Map (60%) */}
          <View style={{ flex: 6 }} className="relative">
            <MapView
              testID="explore_map_view"
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              initialRegion={initialRegion}
              showsUserLocation={!locationDenied}
              showsMyLocationButton={false}
              style={{ flex: 1 }}
            >
              {filteredPlaces.map((place) => {
                const score10 = place.accessibilityScores.overall / 10;
                return (
                  <Marker
                    key={place.id}
                    testID={`explore_marker_${place.id}`}
                    coordinate={place.location}
                    onPress={() => handleMarkerPress(place)}
                    tracksViewChanges={false}
                  >
                    <View
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 3,
                        elevation: 4,
                      }}
                      className={`h-10 w-10 items-center justify-center rounded-full border-2 border-white ${markerColorClass(
                        score10,
                      )}`}
                    >
                      <Text className="text-xs font-bold text-white">
                        {score10.toFixed(1)}
                      </Text>
                    </View>
                  </Marker>
                );
              })}
            </MapView>

            {/* My-location FAB */}
            <Pressable
              testID="explore_my_location_button"
              onPress={handleMyLocation}
              accessibilityRole="button"
              accessibilityLabel="Center map on my location"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.18,
                shadowRadius: 4,
                elevation: 6,
              }}
              className="absolute bottom-4 right-4 h-12 w-12 items-center justify-center rounded-full bg-surface-light dark:bg-surface-dark"
            >
              <Ionicons
                name={locationDenied ? 'location-outline' : 'locate'}
                size={22}
                color={locationDenied ? '#9CA3AF' : '#6366F1'}
              />
            </Pressable>
          </View>

          {/* Horizontal cards (40%) */}
          <View
            style={{ flex: 4 }}
            className="border-t border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark"
          >
            <View className="px-4 pt-3">
              <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Nearby
              </Text>
            </View>
            <FlatList
              testID="explore_cards_scroll"
              data={filteredPlaces}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
              ItemSeparatorComponent={() => <View className="w-2" />}
              renderItem={({ item, index }) => (
                <View style={{ width: 280 }}>
                  <PlaceCard
                    place={item}
                    onPress={() => handleMarkerPress(item)}
                    index={index}
                  />
                </View>
              )}
              ListEmptyComponent={
                <View className="px-4 py-6">
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    {locationDenied
                      ? 'Turn on location to see places near you.'
                      : !userLocation
                        ? 'Finding your location…'
                        : loadingNearby
                          ? 'Finding great places near you…'
                          : 'No top-rated places found here.'}
                  </Text>
                </View>
              }
            />
          </View>

          <PlaceBottomSheet
            place={selectedPlace}
            onClose={handleCloseSheet}
            onViewDetails={handleViewDetails}
            onGetRoute={handleGetRoute}
          />
        </View>
      ) : (
        <FlatList
          testID="explore_list_view"
          data={filteredPlaces}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item, index }) => (
            <PlaceCard
              place={item}
              onPress={() => router.push(`/place/${item.id}`)}
              index={index}
            />
          )}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons
                name={locationDenied ? 'location-outline' : 'search-outline'}
                size={36}
                className="text-gray-400 dark:text-gray-500"
              />
              <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
                {locationDenied
                  ? 'Turn on location to see places near you.'
                  : !userLocation
                    ? 'Finding your location…'
                    : loadingNearby
                      ? 'Finding great places near you…'
                      : 'No top-rated places found here.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
