import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommunityPostCard } from '../../components/CommunityPostCard';
import { HomePlaceCard } from '../../components/HomePlaceCard';
import { GradientAvatar } from '../../components/design/GradientAvatar';
import { MeshPhoto } from '../../components/design/MeshPhoto';
import { AURORA, COLORS, surfaces } from '../../components/design/theme';
import { Wordmark } from '../../components/design/Wordmark';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import {
  calculateDistanceKm,
  getNearbyAttractions,
  getNearbyByTypes,
  nearbyToPlace,
} from '../../services/googleMaps';
import { fetchHomeFeed } from '../../services/firebase';
import { getWeather, type Weather } from '../../services/weather';
import { useAppStore } from '../../stores/appStore';
import { useUserStore } from '../../stores/userStore';
import { isHiddenGem } from '../../utils/place';
import type { Place, Post } from '../../types';

/* -------------------------------------------------------------------------- */
/*  Stories (seed)                                                            */
/* -------------------------------------------------------------------------- */

interface StoryItem {
  uid: string;
  label: string;
  photoURL: string;
  hasUnseen?: boolean;
  seed: number;
}

const SEED_STORIES: StoryItem[] = [
  { uid: 'rohan', label: 'Rohan', photoURL: 'https://i.pravatar.cc/150?img=68', hasUnseen: true, seed: 1 },
  { uid: 'diya', label: 'Diya', photoURL: 'https://i.pravatar.cc/150?img=44', hasUnseen: true, seed: 3 },
  { uid: 'meera', label: 'Meera', photoURL: 'https://i.pravatar.cc/150?img=32', hasUnseen: true, seed: 2 },
  { uid: 'kabir', label: 'Kabir', photoURL: 'https://i.pravatar.cc/150?img=15', hasUnseen: false, seed: 4 },
  { uid: 'arjun', label: 'Arjun', photoURL: 'https://i.pravatar.cc/150?img=12', hasUnseen: false, seed: 5 },
];

/* -------------------------------------------------------------------------- */
/*  Need / category chips                                                     */
/* -------------------------------------------------------------------------- */

interface NeedChip {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Google Place types to query; null = curated "top picks" mix. */
  types: string[] | null;
  /** When set, filter the curated results to hidden gems (high rating, few reviews). */
  gemsOnly?: boolean;
}

const NEED_CHIPS: NeedChip[] = [
  { key: 'top', label: 'Top picks', icon: 'star-four-points', types: null },
  { key: 'gems', label: 'Hidden gems', icon: 'diamond-stone', types: null, gemsOnly: true },
  { key: 'indoor', label: 'Indoor', icon: 'home-roof', types: ['cafe', 'shopping_mall', 'museum', 'library', 'restaurant'] },
  { key: 'calm', label: 'Calm', icon: 'leaf', types: ['park', 'museum', 'art_gallery', 'library', 'cafe'] },
  { key: 'family', label: 'Family', icon: 'account-group', types: ['park', 'shopping_mall', 'amusement_park', 'zoo', 'restaurant'] },
  { key: 'cafe', label: 'Cafés', icon: 'coffee', types: ['cafe', 'bakery'] },
  { key: 'park', label: 'Parks', icon: 'tree', types: ['park'] },
  { key: 'food', label: 'Food', icon: 'silverware-fork-knife', types: ['restaurant'] },
];

/* -------------------------------------------------------------------------- */
/*  Header                                                                     */
/* -------------------------------------------------------------------------- */

function HomeHeader({
  city,
  onActivity,
  onAsk,
}: {
  city: string;
  onActivity: () => void;
  onAsk: () => void;
}) {
  const isDark = useAppStore((s) => s.theme === 'dark');
  const C = surfaces(isDark);
  return (
    <View
      testID="home_header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingTop: 4,
        paddingBottom: 12,
        backgroundColor: isDark ? 'rgba(18,20,26,0.86)' : 'rgba(255,255,255,0.72)',
        borderBottomWidth: 1,
        borderBottomColor: C.hairline,
      }}
    >
      <View>
        <Wordmark />
        {city.length > 0 ? (
          <View
            testID="home_header_city"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, marginLeft: 2 }}
          >
            <Ionicons name="location" size={11} color={COLORS.brand} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: C.ink2 }}>{city}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Pressable
        testID="home_header_ask"
        onPress={onAsk}
        accessibilityRole="button"
        accessibilityLabel="Ask Discova"
        hitSlop={8}
      >
        <MaterialCommunityIcons name="star-four-points" size={23} color={COLORS.brand} />
      </Pressable>
      <Pressable
        testID="home_header_bell"
        onPress={onActivity}
        accessibilityRole="button"
        accessibilityLabel="Activity"
        hitSlop={8}
      >
        <View>
          <Ionicons name="notifications-outline" size={24} color={C.ink} />
          <View
            style={{
              position: 'absolute',
              top: -1,
              right: -1,
              width: 9,
              height: 9,
              borderRadius: 999,
              backgroundColor: COLORS.like,
              borderWidth: 2,
              borderColor: '#FFFFFF',
            }}
          />
        </View>
      </Pressable>
      </View>
    </View>
  );
}

/** "PWD Mode is on" info banner (PWD set at login; toggled only in Settings). */
function PwdBanner() {
  return (
    <View
      testID="home_pwd_banner"
      style={{
        marginHorizontal: 14,
        marginTop: 12,
        padding: 11,
        paddingHorizontal: 13,
        borderRadius: 16,
        backgroundColor: COLORS.aHighBg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: COLORS.aHigh,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons name="wheelchair-accessibility" size={20} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 13, color: COLORS.aHigh }}>PWD Mode is on</Text>
        <Text style={{ fontSize: 11.5, color: '#3f7a5b' }}>
          Earning 2× coins · prioritising accessible places.
        </Text>
      </View>
    </View>
  );
}

/** Daily challenge card — rate a place today for coins. */
function DailyChallengeCard({ onPress, pwd }: { onPress: () => void; pwd: boolean }) {
  const reward = pwd ? 40 : 20;
  return (
    <Pressable
      testID="home_daily_challenge"
      onPress={onPress}
      accessibilityRole="button"
      style={{ marginHorizontal: 14, marginTop: 12, borderRadius: 20, overflow: 'hidden' }}
    >
      <LinearGradient colors={[...AURORA]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="target" size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Today&apos;s challenge</Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 1 }}>
            Rate 1 place&apos;s accessibility · +{reward} coins
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </LinearGradient>
    </Pressable>
  );
}

/** Weather-aware suggestion banner (rain / heat → indoor). */
function WeatherBanner({ weather, onIndoor }: { weather: Weather; onIndoor: () => void }) {
  const rain = weather.isRaining;
  return (
    <Pressable
      testID="home_weather_banner"
      onPress={onIndoor}
      accessibilityRole="button"
      style={{ marginHorizontal: 14, marginTop: 12, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      className="border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark"
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: rain ? 'rgba(46,107,255,0.14)' : 'rgba(246,168,43,0.16)',
        }}
      >
        <Ionicons name={rain ? 'rainy' : 'sunny'} size={20} color={rain ? COLORS.brand : COLORS.coin} />
      </View>
      <View style={{ flex: 1 }}>
        <Text className="text-sm font-bold text-gray-900 dark:text-white">
          {rain ? `${weather.condition} · ${weather.tempC}°` : `Hot day · ${weather.tempC}°`}
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {rain ? 'Stay dry — see indoor accessible spots' : 'Beat the heat — indoor AC spots nearby'}
        </Text>
      </View>
      <View className="rounded-full bg-primary px-3 py-1.5">
        <Text className="text-xs font-semibold text-white">Indoor</Text>
      </View>
    </Pressable>
  );
}

/** Horizontal need / category chips. */
function NeedChips({ activeKey, onChange }: { activeKey: string; onChange: (c: NeedChip) => void }) {
  return (
    <ScrollView
      testID="home_need_chips"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 4, gap: 8 }}
    >
      {NEED_CHIPS.map((c) => {
        const active = c.key === activeKey;
        return (
          <Pressable
            key={c.key}
            testID={`home_need_chip_${c.key}`}
            onPress={() => onChange(c)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`h-9 flex-row items-center rounded-full px-3.5 ${
              active ? 'bg-primary' : 'bg-muted-light dark:bg-muted-dark'
            }`}
          >
            <MaterialCommunityIcons name={c.icon} size={14} color={active ? '#FFFFFF' : '#6B7280'} />
            <Text className={`ml-1.5 text-sm font-semibold ${active ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Horizontal stories rail with own "+ Add" first. */
function StoryRail({
  ownDisplayName,
  ownPhotoURL,
  onAdd,
  onOpen,
}: {
  ownDisplayName: string;
  ownPhotoURL: string | null;
  onAdd: () => void;
  onOpen: (uid: string) => void;
}) {
  return (
    <ScrollView
      testID="home_stories_row"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingVertical: 12 }}
    >
      <Pressable
        testID="home_story_circle_0"
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add to your story"
        style={{ alignItems: 'center', gap: 6, width: 62 }}
      >
        <GradientAvatar name={ownDisplayName} photoURL={ownPhotoURL} size={56} ring ringSeen addPip />
        <Text numberOfLines={1} style={{ fontSize: 11, color: COLORS.ink2, fontWeight: '600', maxWidth: 62 }}>
          Your story
        </Text>
      </Pressable>

      {SEED_STORIES.map((s, i) => (
        <Pressable
          key={s.uid}
          testID={`home_story_circle_${i + 1}`}
          onPress={() => onOpen(s.uid)}
          accessibilityRole="button"
          accessibilityLabel={`${s.label}'s story`}
          style={{ alignItems: 'center', gap: 6, width: 62 }}
        >
          <GradientAvatar name={s.label} photoURL={s.photoURL} seed={s.seed} size={56} ring ringSeen={!s.hasUnseen} />
          <Text numberOfLines={1} style={{ fontSize: 11, color: COLORS.ink2, fontWeight: '600', maxWidth: 62 }}>
            {s.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Pulsing skeleton card during the initial nearby load. */
function SkeletonCard({ index }: { index: number }) {
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const C = surfaces(useAppStore((s) => s.theme === 'dark'));
  return (
    <Animated.View
      testID={`home_skeleton_card_${index}`}
      style={[
        style,
        {
          marginHorizontal: 14,
          marginBottom: 16,
          borderRadius: 24,
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: C.hairline,
          overflow: 'hidden',
        },
      ]}
    >
      <View style={{ width: '100%', aspectRatio: 16 / 10, backgroundColor: C.surface2 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 14 }}>
        <View style={{ height: 12, width: 120, borderRadius: 4, backgroundColor: C.surface2 }} />
        <View style={{ height: 12, width: 50, borderRadius: 4, backgroundColor: C.surface2 }} />
      </View>
    </Animated.View>
  );
}

/** Full-screen story viewer modal. */
function StoryViewer({ story, onClose }: { story: StoryItem | null; onClose: () => void }) {
  return (
    <Modal visible={story !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {story ? (
        <View testID="home_story_viewer" style={{ flex: 1, backgroundColor: '#000' }}>
          <MeshPhoto category="tourist" seed={story.seed} style={{ position: 'absolute', inset: 0 }}>
            <LinearGradient
              colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.7)']}
              locations={[0, 0.4, 1]}
              style={{ position: 'absolute', inset: 0 }}
            />
          </MeshPhoto>

          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 8 }}>
              <View style={{ flex: 1, height: 3, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
                <View style={{ width: '55%', height: '100%', backgroundColor: '#fff' }} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 12 }}>
              <GradientAvatar name={story.label} photoURL={story.photoURL} seed={story.seed} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13.5 }}>{story.label}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>2h ago</Text>
              </View>
              <Pressable testID="home_story_viewer_close" onPress={onClose} hitSlop={10} accessibilityRole="button">
                <Ionicons name="close" size={26} color="#fff" />
              </Pressable>
            </View>

            <Pressable onPress={onClose} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel="Close story" />

            <View style={{ paddingHorizontal: 18, paddingBottom: 40 }}>
              <View
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  marginBottom: 10,
                }}
              >
                <Ionicons name="location" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Nearby place</Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 25 }}>
                {story.label}&apos;s accessibility find ✨
              </Text>
            </View>
          </SafeAreaView>
        </View>
      ) : null}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                     */
/* -------------------------------------------------------------------------- */

type FeedTab = 'discover' | 'community';

/** Discover (AI / real places) ↔ Community (real user posts) tab bar. */
function FeedTabs({ active, onChange }: { active: FeedTab; onChange: (t: FeedTab) => void }) {
  const tabs: Array<{ key: FeedTab; label: string }> = [
    { key: 'discover', label: 'Discover' },
    { key: 'community', label: 'Community' },
  ];
  return (
    <View className="px-4 pb-1 pt-2">
      <View className="flex-row rounded-full bg-muted-light p-1 dark:bg-muted-dark">
        {tabs.map((t) => {
          const sel = active === t.key;
          return (
            <Pressable
              key={t.key}
              testID={`home_feedtab_${t.key}`}
              onPress={() => onChange(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: sel }}
              className={`flex-1 items-center rounded-full py-2 ${sel ? 'bg-primary' : ''}`}
            >
              <Text className={`text-sm font-bold ${sel ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Home — two feeds via a tab bar:
 *  - **Discover**: real Google places near you (AI accessibility, crowd/quiet,
 *    need chips, daily challenge, weather).
 *  - **Community**: real user posts from Firestore (empty until people post).
 */
export default function HomeScreen() {
  const router = useRouter();
  const isDark = useAppStore((s) => s.theme === 'dark');
  const user = useUserStore((s) => s.user);
  const pwd = user?.pwdMode ?? false;

  const { location: userLocation, label: locationLabel } = useLiveLocation();
  // City only labels the cards — keep it in a ref so resolving it doesn't refetch.
  const cityRef = useRef('Nearby');
  cityRef.current = locationLabel.split(',').pop()?.trim() || 'Nearby';

  const [chip, setChip] = useState<NeedChip>(NEED_CHIPS[0]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingStory, setViewingStory] = useState<StoryItem | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [feedTab, setFeedTab] = useState<FeedTab>('discover');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  /** Fetch real nearby places for the active chip. */
  const load = useCallback(async () => {
    if (!userLocation) return;
    setLoading(true);
    try {
      const near = chip.gemsOnly
        ? (await getNearbyAttractions(userLocation, 6000)).filter((np) =>
            isHiddenGem(np.rating, np.totalReviews),
          )
        : chip.types
          ? await getNearbyByTypes(userLocation, 6000, chip.types)
          : await getNearbyAttractions(userLocation, 6000);
      setPlaces(near.map((np) => nearbyToPlace(np, cityRef.current)));
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [userLocation, chip]);

  useEffect(() => {
    void load();
  }, [load]);

  // Current weather (free Open-Meteo) for weather-aware suggestions.
  useEffect(() => {
    if (!userLocation) return;
    let cancelled = false;
    void getWeather(userLocation).then((w) => {
      if (!cancelled) setWeather(w);
    });
    return () => {
      cancelled = true;
    };
  }, [userLocation]);

  /** Switch the feed to indoor-friendly categories. */
  const showIndoor = useCallback(() => {
    const c = NEED_CHIPS.find((x) => x.key === 'indoor');
    if (c) setChip(c);
  }, []);

  /** Load real user posts from Firestore (Community tab). */
  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const { posts: real } = await fetchHomeFeed(undefined, 20);
      setPosts(real);
    } catch {
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    if (feedTab === 'community' && posts.length === 0) void loadPosts();
  }, [feedTab, posts.length, loadPosts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleActivity = useCallback(() => {
    /* Activity sheet not built yet — quiet no-op. */
  }, []);

  const ownDisplayName = user?.displayName ?? 'You';
  const ownPhotoURL = user?.photoURL ?? null;
  const showSkeleton = (loading || !userLocation) && places.length === 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: isDark ? '#0B0C10' : COLORS.bg }}>
      <HomeHeader city={locationLabel} onActivity={handleActivity} onAsk={() => router.push('/ask')} />
      <FeedTabs active={feedTab} onChange={setFeedTab} />

      {feedTab === 'discover' ? (
      <FlatList
        testID="home_feed_flatlist"
        data={places}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <HomePlaceCard
            place={item}
            index={index}
            distanceKm={userLocation ? calculateDistanceKm(userLocation, item.location) : undefined}
            onPress={() => router.push(`/place/${item.id}`)}
          />
        )}
        ListHeaderComponent={
          <View>
            <StoryRail
              ownDisplayName={ownDisplayName}
              ownPhotoURL={ownPhotoURL}
              onAdd={() => router.push('/(tabs)/camera')}
              onOpen={(uid) => setViewingStory(SEED_STORIES.find((s) => s.uid === uid) ?? null)}
            />
            {pwd ? <PwdBanner /> : null}
            {weather?.suggestIndoor ? <WeatherBanner weather={weather} onIndoor={showIndoor} /> : null}
            <DailyChallengeCard pwd={pwd} onPress={() => router.push('/(tabs)/explore')} />
            <NeedChips activeKey={chip.key} onChange={setChip} />
            <Text className="mb-1 mt-3 px-4 text-base font-bold text-gray-900 dark:text-white">
              Accessible places near you
            </Text>
          </View>
        }
        ListEmptyComponent={
          showSkeleton ? (
            <View>
              {[0, 1, 2].map((i) => (
                <SkeletonCard key={i} index={i} />
              ))}
            </View>
          ) : (
            <View className="items-center px-8 py-14">
              <Ionicons name="compass-outline" size={36} color={COLORS.ink3} />
              <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
                No top-rated places found here. Try another filter or pull to refresh.
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brand} colors={[COLORS.brand]} />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
      ) : (
      <FlatList
        testID="home_community_flatlist"
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <CommunityPostCard
            post={item}
            index={index}
            currentUserId={user?.uid ?? ''}
            onPress={() => router.push(`/place/${item.placeId}`)}
          />
        )}
        ListHeaderComponent={
          <View>
            <StoryRail
              ownDisplayName={ownDisplayName}
              ownPhotoURL={ownPhotoURL}
              onAdd={() => router.push('/(tabs)/camera')}
              onOpen={(uid) => setViewingStory(SEED_STORIES.find((s) => s.uid === uid) ?? null)}
            />
            <Text className="mb-1 mt-3 px-4 text-base font-bold text-gray-900 dark:text-white">
              From the community
            </Text>
          </View>
        }
        ListEmptyComponent={
          loadingPosts ? (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color={COLORS.brand} />
            </View>
          ) : (
            <View className="items-center px-8 py-16">
              <Ionicons name="people-outline" size={40} color={COLORS.ink3} />
              <Text className="mt-3 text-base font-bold text-gray-900 dark:text-white">
                No community posts yet
              </Text>
              <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
                Be the first to share an accessible place — real user posts show up here.
              </Text>
              <Pressable
                testID="home_community_empty_cta"
                onPress={() => router.push('/(tabs)/camera')}
                accessibilityRole="button"
                className="mt-4 flex-row items-center rounded-full bg-primary px-4 py-2.5"
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text className="ml-1 text-sm font-semibold text-white">Share a place</Text>
              </Pressable>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={loadingPosts} onRefresh={loadPosts} tintColor={COLORS.brand} colors={[COLORS.brand]} />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
      )}

      <StoryViewer story={viewingStory} onClose={() => setViewingStory(null)} />
    </SafeAreaView>
  );
}
