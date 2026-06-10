import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccessibilityReport } from '../../components/AccessibilityReport';
import { BestTime } from '../../components/BestTime';
import { ComfortCard } from '../../components/ComfortCard';
import { CrowdMeter } from '../../components/CrowdMeter';
import { ScorePill } from '../../components/design/ScorePill';
import { COLORS } from '../../components/design/theme';
import { estimateCrowd } from '../../utils/crowd';
import { isHiddenGem } from '../../utils/place';
import { placeAnalysisAgent } from '../../services/agents/placeAnalysisAgent';
import { cachePlace, fetchPlaceDetails, fetchPlacePosts, fetchPlaceReviews } from '../../services/firebase';
import { getPlaceDetails, type GoogleReview } from '../../services/googleMaps';
import type { Place, Post, Review } from '../../types';

/** Accessibility-dimension chip labels for community reviews. */
const ACCESS_LABELS: Array<{ key: keyof Review['accessibilityRatings']; label: string }> = [
  { key: 'mobility', label: 'Mobility' },
  { key: 'visual', label: 'Visual' },
  { key: 'hearing', label: 'Hearing' },
  { key: 'cognitive', label: 'Cognitive' },
  { key: 'sensory', label: 'Sensory' },
];

/** Compact "3d ago" / "just now" label from an epoch-ms timestamp. */
function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Build a Place skeleton (scores 0) from a Google Place Details result. */
function placeFromGoogle(d: Awaited<ReturnType<typeof getPlaceDetails>>): Place | null {
  if (!d) return null;
  const now = Date.now();
  return {
    id: d.placeId,
    googlePlaceId: d.placeId,
    name: d.name,
    address: d.formattedAddress,
    city: d.city,
    location: d.location,
    category: (d.category || 'place').replace(/_/g, ' '),
    photos: d.photos,
    rating: d.rating,
    totalReviews: d.totalReviews,
    accessibilityScores: { overall: 0, mobility: 0, visual: 0, hearing: 0, cognitive: 0, sensory: 0 },
    aiAnalysis: null,
    phoneNumber: d.phoneNumber,
    website: d.website,
    hours: null,
    createdAt: now,
    updatedAt: now,
  };
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_HEIGHT = 320;

/* -------------------------------------------------------------------------- */
/*  Seed data                                                                 */
/* -------------------------------------------------------------------------- */

const NOW = Date.now();

/** Build a 4-photo gallery for a place from its id. */
function buildPhotos(id: string): string[] {
  return [1, 2, 3, 4].map((i) => `https://picsum.photos/seed/${id}-${i}/800/800`);
}

const DELHI_PLACES: Place[] = [
  {
    id: 'india_gate',
    googlePlaceId: '',
    name: 'India Gate',
    address: 'Rajpath, India Gate, New Delhi',
    city: 'Delhi',
    location: { latitude: 28.6129, longitude: 77.2295 },
    category: 'monument',
    photos: buildPhotos('india-gate'),
    rating: 4.6,
    totalReviews: 1240,
    accessibilityScores: {
      overall: 90, mobility: 85, visual: 80, hearing: 70, cognitive: 65, sensory: 60,
    },
    aiAnalysis: {
      hasRamp: true, hasElevator: false, hasBrailleSignage: false, hasSignLanguage: false,
      hasWideEntries: true, hasAccessibleParking: true, hasAccessibleRestroom: true,
      hasTactilePaving: false, hasQuietZone: false, hasStairs: true, stairsCount: 8,
      hasNarrowDoor: false, noiseLevel: 'medium', lightingLevel: 'high', crowdLevel: 'high',
      accessibilityScore: 80, wheelchairScore: 85, visualScore: 60,
      detectedFeatures: ['wheelchair ramp', 'wide pathways', 'accessible parking', 'open layout'],
      warningFeatures: ['high crowd levels', 'no covered seating'],
      summary: 'Open paths and a long ramp make the lawn approachable; expect heavy crowds on weekends.',
      confidence: 0.82, lastAnalyzed: NOW - 86400 * 1000,
    },
    phoneNumber: null, website: null, hours: null, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'select_city_walk',
    googlePlaceId: '',
    name: 'Select City Walk',
    address: 'A-3 District Centre, Saket, New Delhi',
    city: 'Delhi',
    location: { latitude: 28.5286, longitude: 77.2189 },
    category: 'mall',
    photos: buildPhotos('select-city'),
    rating: 4.5, totalReviews: 980,
    accessibilityScores: {
      overall: 92, mobility: 95, visual: 85, hearing: 80, cognitive: 75, sensory: 70,
    },
    aiAnalysis: {
      hasRamp: true, hasElevator: true, hasBrailleSignage: true, hasSignLanguage: false,
      hasWideEntries: true, hasAccessibleParking: true, hasAccessibleRestroom: true,
      hasTactilePaving: true, hasQuietZone: false, hasStairs: false, stairsCount: 0,
      hasNarrowDoor: false, noiseLevel: 'medium', lightingLevel: 'high', crowdLevel: 'medium',
      accessibilityScore: 95, wheelchairScore: 95, visualScore: 85,
      detectedFeatures: ['elevators on every floor', 'tactile paving', 'wide doors', 'accessible restrooms', 'designated parking'],
      warningFeatures: [],
      summary: 'Best-in-class mall accessibility — elevators, ramps, tactile paving and accessible restrooms throughout.',
      confidence: 0.9, lastAnalyzed: NOW - 86400 * 1000,
    },
    phoneNumber: null, website: null, hours: null, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'connaught_place',
    googlePlaceId: '',
    name: 'Connaught Place',
    address: 'Connaught Place, New Delhi',
    city: 'Delhi',
    location: { latitude: 28.6315, longitude: 77.2167 },
    category: 'shopping',
    photos: buildPhotos('connaught-place'),
    rating: 4.2, totalReviews: 2100,
    accessibilityScores: {
      overall: 65, mobility: 60, visual: 55, hearing: 50, cognitive: 55, sensory: 50,
    },
    aiAnalysis: {
      hasRamp: true, hasElevator: false, hasBrailleSignage: false, hasSignLanguage: false,
      hasWideEntries: true, hasAccessibleParking: false, hasAccessibleRestroom: false,
      hasTactilePaving: false, hasQuietZone: false, hasStairs: true, stairsCount: 4,
      hasNarrowDoor: false, noiseLevel: 'high', lightingLevel: 'medium', crowdLevel: 'high',
      accessibilityScore: 60, wheelchairScore: 55, visualScore: 50,
      detectedFeatures: ['ramps at some entrances', 'wide colonnades'],
      warningFeatures: ['uneven pavement in places', 'limited accessible restrooms', 'high crowds'],
      summary: 'Historic colonnades are wide and shaded but accessible restrooms are scarce; expect uneven surfaces.',
      confidence: 0.75, lastAnalyzed: NOW - 86400 * 1000,
    },
    phoneNumber: null, website: null, hours: null, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'hauz_khas',
    googlePlaceId: '',
    name: 'Hauz Khas',
    address: 'Hauz Khas Village, New Delhi',
    city: 'Delhi',
    location: { latitude: 28.553, longitude: 77.205 },
    category: 'neighborhood',
    photos: buildPhotos('hauz-khas'),
    rating: 4.3, totalReviews: 760,
    accessibilityScores: {
      overall: 35, mobility: 25, visual: 30, hearing: 40, cognitive: 45, sensory: 35,
    },
    aiAnalysis: {
      hasRamp: false, hasElevator: false, hasBrailleSignage: false, hasSignLanguage: false,
      hasWideEntries: false, hasAccessibleParking: false, hasAccessibleRestroom: false,
      hasTactilePaving: false, hasQuietZone: false, hasStairs: true, stairsCount: 14,
      hasNarrowDoor: true, noiseLevel: 'high', lightingLevel: 'low', crowdLevel: 'high',
      accessibilityScore: 30, wheelchairScore: 20, visualScore: 30,
      detectedFeatures: ['scenic views'],
      warningFeatures: ['cobbled stairs', 'narrow alleyways', 'no ramps', 'no accessible restrooms'],
      summary: 'Photogenic but tough access — cobbled stairs and narrow alleys make wheelchair travel difficult.',
      confidence: 0.78, lastAnalyzed: NOW - 86400 * 1000,
    },
    phoneNumber: null, website: null, hours: null, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'humayuns_tomb',
    googlePlaceId: '',
    name: "Humayun's Tomb",
    address: 'Mathura Road, Nizamuddin, New Delhi',
    city: 'Delhi',
    location: { latitude: 28.5933, longitude: 77.2507 },
    category: 'monument',
    photos: buildPhotos('humayuns-tomb'),
    rating: 4.5, totalReviews: 1530,
    accessibilityScores: {
      overall: 50, mobility: 45, visual: 50, hearing: 55, cognitive: 60, sensory: 50,
    },
    aiAnalysis: {
      hasRamp: true, hasElevator: false, hasBrailleSignage: false, hasSignLanguage: false,
      hasWideEntries: true, hasAccessibleParking: true, hasAccessibleRestroom: true,
      hasTactilePaving: false, hasQuietZone: false, hasStairs: true, stairsCount: 12,
      hasNarrowDoor: false, noiseLevel: 'low', lightingLevel: 'high', crowdLevel: 'medium',
      accessibilityScore: 55, wheelchairScore: 50, visualScore: 50,
      detectedFeatures: ['ramp at main entry', 'accessible parking', 'wide pathways'],
      warningFeatures: ['stairs to inner chambers', 'historic surfaces uneven'],
      summary: 'Gardens are wheelchair-friendly but reaching the upper chamber requires stairs.',
      confidence: 0.8, lastAnalyzed: NOW - 86400 * 1000,
    },
    phoneNumber: null, website: null, hours: null, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'igi_airport',
    googlePlaceId: '',
    name: 'Indira Gandhi Airport',
    address: 'IGI Airport, New Delhi',
    city: 'Delhi',
    location: { latitude: 28.5562, longitude: 77.0999 },
    category: 'airport',
    photos: buildPhotos('igi-airport'),
    rating: 4.4, totalReviews: 4280,
    accessibilityScores: {
      overall: 88, mobility: 90, visual: 85, hearing: 80, cognitive: 75, sensory: 70,
    },
    aiAnalysis: {
      hasRamp: true, hasElevator: true, hasBrailleSignage: true, hasSignLanguage: true,
      hasWideEntries: true, hasAccessibleParking: true, hasAccessibleRestroom: true,
      hasTactilePaving: true, hasQuietZone: true, hasStairs: false, stairsCount: 0,
      hasNarrowDoor: false, noiseLevel: 'medium', lightingLevel: 'high', crowdLevel: 'high',
      accessibilityScore: 88, wheelchairScore: 90, visualScore: 85,
      detectedFeatures: ['ramps everywhere', 'elevators', 'tactile paving', 'sign language assistance', 'quiet room', 'accessible washrooms'],
      warningFeatures: ['busy terminals at peak hours'],
      summary: 'Airport-grade accessibility — every facility from tactile paving to a quiet room.',
      confidence: 0.92, lastAnalyzed: NOW - 86400 * 1000,
    },
    phoneNumber: null, website: null, hours: null, createdAt: NOW, updatedAt: NOW,
  },
];

/* -------------------------------------------------------------------------- */
/*  Posts grid + stories                                                      */
/* -------------------------------------------------------------------------- */


/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

type Tab = 'posts' | 'reviews' | 'summary';

/** Photo gallery with horizontal paging, dots, and N/M counter. */
function PhotoGallery({ photos }: { photos: string[] }) {
  const [active, setActive] = useState(0);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (idx !== active) setActive(idx);
    },
    [active],
  );

  const renderPhoto = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <Image
        source={{ uri: item }}
        style={{ width: SCREEN_WIDTH, height: GALLERY_HEIGHT }}
        resizeMode="cover"
      />
    ),
    [],
  );

  return (
    <View testID="place_detail_gallery" className="relative bg-black">
      <FlatList
        data={photos}
        keyExtractor={(item) => item}
        renderItem={renderPhoto}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
      />

      {/* Photo counter */}
      <View className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1">
        <Text testID="place_detail_gallery_counter" className="text-xs font-medium text-white">
          {active + 1} / {photos.length}
        </Text>
      </View>

      {/* Dot indicators */}
      <View className="absolute bottom-3 left-0 right-0 flex-row justify-center">
        {photos.map((p, i) => (
          <View
            key={p}
            testID={`place_detail_gallery_dot_${i}`}
            className={`mx-0.5 h-1.5 rounded-full ${
              i === active ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
            }`}
          />
        ))}
      </View>
    </View>
  );
}

/** Real "Open · Closes 10 PM" / "Closed · Opens 9 AM" status badge from Google
 *  hours. Renders nothing when hours are unknown. */
function OpenClosedBadge({
  isOpenNow,
  todayHours,
}: {
  isOpenNow: boolean | null;
  todayHours: { open: string; close: string } | null;
}) {
  if (isOpenNow === null) return null;
  const closeStr = todayHours?.close;
  const openStr = todayHours?.open;
  const text = isOpenNow
    ? closeStr
      ? `Open · Closes ${closeStr}`
      : 'Open now'
    : openStr
      ? `Closed · Opens ${openStr}`
      : 'Closed';
  return (
    <View
      testID="place_detail_open_badge"
      className={`flex-row items-center rounded-full px-2.5 py-1 ${
        isOpenNow ? 'bg-success/15' : 'bg-danger/15'
      }`}
    >
      <View className={`h-1.5 w-1.5 rounded-full ${isOpenNow ? 'bg-success' : 'bg-danger'}`} />
      <Text className={`ml-1.5 text-xs font-medium ${isOpenNow ? 'text-success' : 'text-danger'}`}>
        {text}
      </Text>
    </View>
  );
}


/** "Posts / Reviews / AI Summary" sticky tab bar. */
function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}) {
  const tabs: Array<{ key: Tab; label: string; testID: string }> = [
    { key: 'posts', label: 'Posts', testID: 'place_detail_tab_posts' },
    { key: 'reviews', label: 'Reviews', testID: 'place_detail_tab_reviews' },
    { key: 'summary', label: 'AI Summary', testID: 'place_detail_tab_summary' },
  ];

  return (
    <View className="flex-row border-b border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark">
      {tabs.map((t) => {
        const selected = active === t.key;
        return (
          <Pressable
            key={t.key}
            testID={t.testID}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`flex-1 items-center py-3 ${
              selected ? 'border-b-2 border-primary' : ''
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                selected
                  ? 'text-primary'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}


/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Place detail screen.
 * Reads `id` from the route, locates the matching seed place, and renders
 * gallery + accessibility report + tabbed body (posts / reviews / AI summary)
 * with sticky bottom actions.
 */
export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [place, setPlace] = useState<Place | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [googleReviews, setGoogleReviews] = useState<GoogleReview[]>([]);
  const [communityReviews, setCommunityReviews] = useState<Review[]>([]);
  const [placePosts, setPlacePosts] = useState<Post[]>([]);
  const [openInfo, setOpenInfo] = useState<{
    isOpenNow: boolean | null;
    todayHours: { open: string; close: string } | null;
  }>({ isOpenNow: null, todayHours: null });

  // Community reviews + real posts for this place, from Firestore. Reloaded on
  // focus so a review/post made elsewhere appears on return.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!id) return;
        try {
          const [list, posts] = await Promise.all([fetchPlaceReviews(id), fetchPlacePosts(id)]);
          if (active) {
            setCommunityReviews(list);
            setPlacePosts(posts);
          }
        } catch {
          /* community data optional */
        }
      })();
      return () => {
        active = false;
      };
    }, [id]),
  );

  // Resolve the place: seed first, else fetch from Google + run AI analysis.
  useEffect(() => {
    let cancelled = false;
    setLoadingPlace(true);
    setAnalyzing(false);

    const seed = DELHI_PLACES.find((p) => p.id === id);
    if (seed) {
      setPlace(seed);
      setLoadingPlace(false);
      return;
    }

    (async () => {
      // 1. Firestore cache first — if someone already analyzed this place,
      //    load the saved scores instantly (no AI call, shared across users).
      const cached = await fetchPlaceDetails(id ?? '');
      if (cancelled) return;
      if (cached && cached.accessibilityScores.overall > 0) {
        setPlace(cached);
        setLoadingPlace(false);
        return;
      }

      // 2. Not cached — fetch from Google.
      const details = await getPlaceDetails(id ?? '');
      if (cancelled) return;
      setGoogleReviews(details?.reviews ?? []);
      setOpenInfo({
        isOpenNow: details?.isOpenNow ?? null,
        todayHours: details?.todayHours ?? null,
      });
      const built = placeFromGoogle(details);
      setPlace(built);
      setLoadingPlace(false);

      if (built) {
        // 3. AI decides accessibility from Google's photos + reviews.
        setAnalyzing(true);
        try {
          const result = await placeAnalysisAgent.analyzePlace({
            name: built.name,
            photos: built.photos,
            reviews: (details?.reviews ?? []).map((r) => r.text),
          });
          if (cancelled) return;
          const analyzed: Place = {
            ...built,
            accessibilityScores: result.scores,
            aiAnalysis: result.analysis,
          };
          setPlace(analyzed);
          // 4. Cache the result so the next visitor — and everyone — gets it
          //    instantly. This grows the shared accessibility database.
          void cachePlace(analyzed);
        } finally {
          if (!cancelled) setAnalyzing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const [activeTab, setActiveTab] = useState<Tab>('posts');

  /** Native share dialog with the place's name + city. */
  const handleShare = useCallback(async () => {
    if (!place) return;
    try {
      await Share.share({
        title: place.name,
        message: `Check out ${place.name} on Discova — accessibility score ${(place.accessibilityScores.overall / 10).toFixed(1)}/10.`,
      });
    } catch {
      /* user cancelled */
    }
  }, [place]);

  /** Open the platform maps app for turn-by-turn directions. */
  const handleGetRoute = useCallback(() => {
    if (!place) return;
    const { latitude, longitude } = place.location;
    const label = encodeURIComponent(place.name);
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${latitude},${longitude}&q=${label}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        /* no maps app installed */
      });
    }
  }, [place]);

  /** Send the user to the camera tab to add an experience. */
  const handleAddExperience = useCallback(() => {
    router.push('/(tabs)/camera');
  }, [router]);

  /** Open the accessibility review form for this place. */
  const handleWriteReview = useCallback(() => {
    if (!place) return;
    router.push({
      pathname: '/review/[placeId]',
      params: { placeId: place.id, name: place.name },
    });
  }, [place, router]);

  // Loading the place (Google fetch in flight).
  if (loadingPlace) {
    return (
      <SafeAreaView
        testID="place_detail_loading"
        className="flex-1 items-center justify-center bg-surface-light dark:bg-surface-dark"
      >
        <ActivityIndicator size="large" color="#2E6BFF" />
        <Text className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Loading place…
        </Text>
      </SafeAreaView>
    );
  }

  // Place not found — invalid id.
  if (!place) {
    return (
      <SafeAreaView
        testID="place_detail_not_found"
        className="flex-1 items-center justify-center bg-surface-light dark:bg-surface-dark"
      >
        <Ionicons name="alert-circle-outline" size={48} color="#6B7280" />
        <Text className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
          Place not found
        </Text>
        <Pressable
          testID="place_detail_not_found_back"
          onPress={() => router.back()}
          accessibilityRole="button"
          className="mt-4 h-11 flex-row items-center justify-center rounded-2xl bg-primary px-6"
        >
          <Text className="text-sm font-semibold text-white">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-surface-light dark:bg-surface-dark">
      <SafeAreaView edges={['top']} className="bg-surface-light dark:bg-surface-dark">
        {/* Header */}
        <View
          testID="place_detail_header"
          className="flex-row items-center justify-between px-3 py-2"
        >
          <Pressable
            testID="place_detail_back_button"
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark"
          >
            <Ionicons
              name="arrow-back"
              size={20}
              className="text-gray-900 dark:text-white"
            />
          </Pressable>
          <Text
            numberOfLines={1}
            className="mx-3 flex-1 text-center text-base font-semibold text-gray-900 dark:text-white"
          >
            {place.name}
          </Text>
          <Pressable
            testID="place_detail_share_button"
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel={`Share ${place.name}`}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark"
          >
            <Ionicons
              name="share-social-outline"
              size={18}
              className="text-gray-900 dark:text-white"
            />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        testID="place_detail_scroll"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo gallery */}
        <PhotoGallery photos={place.photos} />

        {/* Place info */}
        <View className="px-4 pt-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                {place.name}
              </Text>
              <Text className="mt-0.5 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {place.category}
              </Text>
              {isHiddenGem(place.rating, place.totalReviews) ? (
                <View
                  testID="place_detail_gem_badge"
                  className="mt-1 flex-row items-center self-start rounded-full px-2 py-0.5"
                  style={{ gap: 4, backgroundColor: 'rgba(122,61,245,0.12)' }}
                >
                  <Ionicons name="diamond" size={11} color="#7A3DF5" />
                  <Text className="text-[11px] font-bold" style={{ color: '#7A3DF5' }}>
                    Hidden gem · usually less crowded
                  </Text>
                </View>
              ) : null}
              <Text className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                {place.address}
              </Text>
            </View>
            {place.accessibilityScores.overall > 0 ? (
              <ScorePill score={place.accessibilityScores.overall} size="md" />
            ) : null}
          </View>

          <View className="mt-3 flex-row items-center">
            <OpenClosedBadge isOpenNow={openInfo.isOpenNow} todayHours={openInfo.todayHours} />
            <View className="ml-2 flex-row items-center">
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text className="ml-1 text-xs text-gray-700 dark:text-gray-200">
                {place.rating.toFixed(1)} ({place.totalReviews.toLocaleString()})
              </Text>
            </View>
          </View>
        </View>

        {/* Accessibility report */}
        <View className="px-4 pt-5">
          {analyzing ? (
            <View
              testID="place_detail_ai_analyzing"
              className="mb-3 flex-row items-center rounded-2xl bg-primary-50 px-4 py-3 dark:bg-primary-900"
            >
              <ActivityIndicator size="small" color="#2E6BFF" />
              <Text className="ml-3 text-sm font-medium text-primary-700 dark:text-primary-200">
                AI is analyzing accessibility…
              </Text>
            </View>
          ) : null}
          <AccessibilityReport place={place} />
          <View className="mt-3">
            <CrowdMeter
              testID="place_detail_crowd_meter"
              size="md"
              estimate={estimateCrowd({
                category: place.category,
                totalReviews: place.totalReviews,
                aiAnalysis: place.aiAnalysis,
              })}
            />
          </View>
          <View className="mt-3">
            <BestTime testID="place_detail_best_time" category={place.category} />
          </View>
          <View className="mt-3">
            <ComfortCard
              testID="place_detail_comfort"
              input={{
                category: place.category,
                totalReviews: place.totalReviews,
                aiAnalysis: place.aiAnalysis,
              }}
            />
          </View>
        </View>

        {/* Tab bar */}
        <View className="mt-4">
          <TabBar active={activeTab} onChange={setActiveTab} />
        </View>

        {/* Tab body */}
        {activeTab === 'posts' ? (
          placePosts.length > 0 ? (
            <View testID="place_detail_posts_grid" className="flex-row flex-wrap p-1">
              {placePosts.map((p, i) => (
                <Pressable key={p.id} testID={`place_detail_posts_cell_${i}`} className="w-1/3 p-0.5">
                  <Image
                    source={{ uri: p.imageUrl }}
                    className="aspect-square w-full bg-muted-light dark:bg-muted-dark"
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </View>
          ) : (
            <View testID="place_detail_posts_empty" className="items-center px-8 py-14">
              <Ionicons name="images-outline" size={36} color={COLORS.ink3} />
              <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
                No posts for this place yet. Tap “Add Experience” below to be the first.
              </Text>
            </View>
          )
        ) : null}

        {activeTab === 'reviews' ? (
          <View className="px-4 pt-3">
            {/* Write an accessibility review */}
            <Pressable
              testID="place_detail_write_review"
              onPress={handleWriteReview}
              accessibilityRole="button"
              accessibilityLabel="Rate this place's accessibility"
              className="mb-4 flex-row items-center justify-center rounded-2xl border-2 border-primary py-3"
            >
              <MaterialCommunityIcons
                name="wheelchair-accessibility"
                size={18}
                color={COLORS.brand}
              />
              <Text className="ml-2 text-sm font-semibold text-primary">Rate accessibility</Text>
            </Pressable>

            {/* Community (DISCOVA) accessibility reviews */}
            {communityReviews.length > 0 ? (
              <>
                <View className="mb-2 flex-row items-center">
                  <Ionicons name="people" size={14} color="#6B7280" />
                  <Text className="ml-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Community reviews
                  </Text>
                </View>
                {communityReviews.map((rv) => (
                  <View
                    key={rv.id}
                    testID={`place_detail_community_review_${rv.id}`}
                    className="mb-3 rounded-2xl border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark"
                  >
                    <View className="flex-row items-center">
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/15">
                        <Text className="text-xs font-semibold text-primary">
                          {(rv.userDisplayName || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="ml-2">
                        <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                          {rv.userDisplayName || 'Discova user'}
                        </Text>
                        <View className="flex-row items-center">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Ionicons
                              key={s}
                              name={s <= rv.rating ? 'star' : 'star-outline'}
                              size={10}
                              color="#F59E0B"
                            />
                          ))}
                          <Text className="ml-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                            {timeAgo(rv.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {rv.text.length > 0 ? (
                      <Text className="mt-2 text-sm leading-5 text-gray-800 dark:text-gray-100">
                        {rv.text}
                      </Text>
                    ) : null}
                    {ACCESS_LABELS.some(({ key }) => rv.accessibilityRatings[key] > 0) ? (
                      <View className="mt-2 flex-row flex-wrap">
                        {ACCESS_LABELS.filter(({ key }) => rv.accessibilityRatings[key] > 0).map(
                          ({ key, label }) => (
                            <View
                              key={key}
                              className="mb-1.5 mr-1.5 rounded-full bg-muted-light px-2 py-0.5 dark:bg-muted-dark"
                            >
                              <Text className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                                {label} {rv.accessibilityRatings[key]}/5
                              </Text>
                            </View>
                          ),
                        )}
                      </View>
                    ) : null}
                  </View>
                ))}
              </>
            ) : null}

            {/* Google reviews */}
            {googleReviews.length > 0 ? (
              <>
                <View className="mb-2 mt-1 flex-row items-center">
                  <Ionicons name="logo-google" size={14} color="#6B7280" />
                  <Text className="ml-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Google reviews
                  </Text>
                </View>
                {googleReviews.map((rv, i) => (
                  <View
                    key={`g-${i}`}
                    testID={`place_detail_review_card_${i}`}
                    className="mb-3 rounded-2xl border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark">
                          <Text className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                            {rv.author.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View className="ml-2">
                          <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                            {rv.author}
                          </Text>
                          <View className="flex-row items-center">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Ionicons
                                key={s}
                                name={s <= Math.round(rv.rating) ? 'star' : 'star-outline'}
                                size={10}
                                color="#F59E0B"
                              />
                            ))}
                            {rv.relativeTime.length > 0 ? (
                              <Text className="ml-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                                {rv.relativeTime}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    </View>
                    <Text
                      numberOfLines={5}
                      className="mt-2 text-sm leading-5 text-gray-800 dark:text-gray-100"
                    >
                      {rv.text}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            {/* Empty state — neither community nor Google reviews yet */}
            {communityReviews.length === 0 && googleReviews.length === 0 ? (
              <Text className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {analyzing
                  ? 'Loading reviews…'
                  : 'No reviews yet — be the first to rate accessibility.'}
              </Text>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'summary' ? (
          <View testID="place_detail_ai_summary" className="px-4 pt-4">
            <LinearGradient
              colors={['#7C3AED', '#6366F1', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="overflow-hidden rounded-3xl p-5"
            >
              <View className="flex-row items-center">
                <MaterialCommunityIcons name="star-four-points" size={20} color="#FFFFFF" />
                <Text className="ml-2 text-sm font-semibold text-white">
                  Gemini AI summary
                </Text>
              </View>
              <Text className="mt-3 text-base font-medium text-white">
                {place.aiAnalysis?.summary ??
                  'No AI summary yet. Add an experience to generate one.'}
              </Text>
              {place.aiAnalysis ? (
                <View className="mt-4 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={12} color="#FFFFFF" />
                    <Text className="ml-1 text-[11px] text-white/80">
                      Analyzed{' '}
                      {Math.max(
                        1,
                        Math.floor(
                          (Date.now() - place.aiAnalysis.lastAnalyzed) /
                            (24 * 60 * 60 * 1000),
                        ),
                      )}
                      d ago
                    </Text>
                  </View>
                  <Text className="text-[11px] text-white/80">
                    Confidence{' '}
                    {(place.aiAnalysis.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              ) : null}
            </LinearGradient>

            {/* Feature chips beneath the summary card */}
            {place.aiAnalysis && place.aiAnalysis.detectedFeatures.length > 0 ? (
              <View className="mt-4">
                <Text className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                  Highlights
                </Text>
                <View className="flex-row flex-wrap">
                  {place.aiAnalysis.detectedFeatures.map((feature, i) => (
                    <View
                      key={`${feature}-${i}`}
                      className="mb-2 mr-2 flex-row items-center rounded-full bg-success/15 px-2.5 py-1"
                    >
                      <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                      <Text className="ml-1 text-xs font-medium text-success">
                        {feature}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Fixed bottom action bar */}
      <SafeAreaView
        edges={['bottom']}
        className="border-t border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark"
      >
        <View className="flex-row p-3">
          <Pressable
            testID="place_detail_add_experience"
            onPress={handleAddExperience}
            accessibilityRole="button"
            accessibilityLabel="Add an experience"
            className="mr-2 h-12 flex-1 flex-row items-center justify-center rounded-2xl border-2 border-primary bg-surface-light dark:bg-surface-dark"
          >
            <Ionicons name="add-circle-outline" size={18} color="#6366F1" />
            <Text className="ml-2 text-sm font-semibold text-primary">
              Add Experience
            </Text>
          </Pressable>
          <Pressable
            testID="place_detail_get_route"
            onPress={handleGetRoute}
            accessibilityRole="button"
            accessibilityLabel={`Get directions to ${place.name}`}
            className="ml-2 h-12 flex-1 flex-row items-center justify-center rounded-2xl bg-primary"
          >
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
            <Text className="ml-2 text-sm font-semibold text-white">Get Route</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
