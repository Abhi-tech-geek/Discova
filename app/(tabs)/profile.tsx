import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing as RNEasing,
} from 'react-native-reanimated';

import { BadgeCard } from '../../components/BadgeCard';
import { GradientAvatar } from '../../components/design/GradientAvatar';
import {
  fetchUserPosts,
  signOutUser,
  updateUserProfile,
  uploadMedia,
} from '../../services/firebase';
import { useUserStore } from '../../stores/userStore';
import type {
  Badge,
  BadgeRarity,
  DisabilityType,
  Post,
  UserStats,
} from '../../types';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

interface DisabilityChipDef {
  type: DisabilityType;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const DISABILITY_CHIPS: DisabilityChipDef[] = [
  { type: 'mobility', label: 'Wheelchair', icon: 'wheelchair' },
  { type: 'visual', label: 'Visual', icon: 'eye-off-outline' },
  { type: 'hearing', label: 'Hearing', icon: 'ear-hearing' },
  // "Senior" doesn't map cleanly onto the DisabilityType union — using
  // 'cognitive' as the closest fit so we don't widen the underlying type.
  { type: 'cognitive', label: 'Senior', icon: 'walk' },
];

interface BadgeRow {
  badge: Badge;
  isEarned: boolean;
  progress?: number;
  required?: number;
}

/** Quick badge factory for the hardcoded catalog below. */
function makeBadge(
  id: string,
  name: string,
  description: string,
  icon: string,
  rarity: BadgeRarity,
  requirement: string,
  coinReward: number,
): Badge {
  return { id, name, description, icon, rarity, requirement, coinReward };
}

/** Build the badge list with earned-state derived from the user's REAL stats,
 *  so a new user starts with everything locked. */
function badgeRows(stats: UserStats, pwdMode: boolean, streak: number): BadgeRow[] {
  return [
    {
      badge: makeBadge('first_post', 'First Steps', 'Shared your first accessibility post.', '👣', 'common', 'Create 1 post', 50),
      isEarned: stats.postsCount >= 1,
    },
    {
      badge: makeBadge('helpful_voice', 'Helpful Voice', 'Wrote 5 detailed reviews.', '🗣️', 'common', 'Write 5 reviews', 75),
      isEarned: stats.reviewsCount >= 5,
      progress: stats.reviewsCount,
      required: 5,
    },
    {
      badge: makeBadge('inclusive_ally', 'Inclusive Ally', 'Posted with PWD mode on.', '🤝', 'rare', 'Post in PWD mode', 150),
      isEarned: pwdMode && stats.postsCount >= 1,
    },
    {
      badge: makeBadge('explorer_10', 'Explorer', 'Shared 10 accessibility posts.', '🧭', 'rare', 'Create 10 posts', 150),
      isEarned: stats.postsCount >= 10,
      progress: stats.postsCount,
      required: 10,
    },
    {
      badge: makeBadge('pioneer_5', 'Pioneer', 'Add 5 new places to Discova.', '🌱', 'rare', 'Add 5 places', 200),
      isEarned: stats.placesAdded >= 5,
      progress: stats.placesAdded,
      required: 5,
    },
    {
      badge: makeBadge('streak_21', 'Consistent', 'Stay active 21 days in a row.', '⚡', 'epic', '21-day streak', 300),
      isEarned: streak >= 21,
      progress: streak,
      required: 21,
    },
    {
      badge: makeBadge('trailblazer_50', 'Trailblazer', 'Share 50 accessibility posts.', '🔥', 'epic', 'Create 50 posts', 500),
      isEarned: stats.postsCount >= 50,
      progress: stats.postsCount,
      required: 50,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Reanimated-driven number counter.
 * Uses `Animated.createAnimatedComponent(TextInput)` because the standard
 * `Text` component can't receive its content via `animatedProps`.
 */
function AnimatedCounter({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const v = useSharedValue(0);

  useEffect(() => {
    v.value = withTiming(value, {
      duration: 1100,
      easing: RNEasing.out(RNEasing.cubic),
    });
  }, [value, v]);

  const animatedProps = useAnimatedProps<TextInputProps & { text?: string }>(
    () => ({
      text: String(Math.floor(v.value)),
    }),
  );

  return (
    <AnimatedTextInput
      editable={false}
      defaultValue={String(value)}
      animatedProps={animatedProps}
      style={{ padding: 0, fontSize: 36, fontWeight: '700', color: '#FFFFFF' }}
      className={className}
    />
  );
}

/** One stat column for the three-up stat row. */
function StatColumn({
  label,
  value,
  testID,
}: {
  label: string;
  value: number;
  testID: string;
}) {
  return (
    <View testID={testID} className="flex-1 items-center">
      <Text className="text-xl font-bold text-gray-900 dark:text-white">{value}</Text>
      <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Profile tab.
 * Reads the signed-in user from `userStore` and lets them edit their photo,
 * disability profile, PWD-mode flag, and sign out. All mutations write back
 * to Firebase first, then mirror into Zustand on success.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const togglePWDModeStore = useUserStore((s) => s.togglePWDMode);
  const setDisabilityTypeStore = useUserStore((s) => s.setDisabilityType);
  const signOutStore = useUserStore((s) => s.signOut);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userPosts, setUserPosts] = useState<Post[]>([]);

  // Real posts by this user (Firestore). New users have none → empty grid.
  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchUserPosts(user.uid)
      .then((p) => {
        if (active) setUserPosts(p);
      })
      .catch(() => {
        /* posts optional */
      });
    return () => {
      active = false;
    };
  }, [user?.uid]);

  /** Open the gallery to pick a new profile photo, then upload + persist. */
  const handleEditPhoto = useCallback(async () => {
    if (!user || photoUploading) return;
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (picked.canceled || !picked.assets[0]) return;
      setPhotoUploading(true);
      const url = await uploadMedia(
        picked.assets[0].uri,
        `avatars/${user.uid}_${Date.now()}.jpg`,
      );
      await updateUserProfile(user.uid, { photoURL: url });
      setUser({ ...user, photoURL: url });
    } catch {
      /* user cancelled or upload failed — silent for now */
    } finally {
      setPhotoUploading(false);
    }
  }, [user, photoUploading, setUser]);

  /** Identify-as-PWD flag is derived from disabilityType !== 'none'. */
  const isPWDIdentity = user ? user.disabilityType !== 'none' : false;

  /** Toggle the PWD identity flag. Switches disabilityType to/from 'none'. */
  const handlePWDToggle = useCallback(
    async (value: boolean) => {
      if (!user) return;
      const nextType: DisabilityType = value ? 'mobility' : 'none';
      setDisabilityTypeStore(nextType);
      try {
        await updateUserProfile(user.uid, { disabilityType: nextType });
      } catch {
        // Revert on failure.
        setDisabilityTypeStore(user.disabilityType);
      }
    },
    [user, setDisabilityTypeStore],
  );

  /** Pick a specific disability category from the chip row. */
  const handleChipSelect = useCallback(
    async (type: DisabilityType) => {
      if (!user) return;
      const previous = user.disabilityType;
      setDisabilityTypeStore(type);
      try {
        await updateUserProfile(user.uid, { disabilityType: type });
      } catch {
        setDisabilityTypeStore(previous);
      }
    },
    [user, setDisabilityTypeStore],
  );

  /** Flip the PWD Mode (coin multiplier) flag. */
  const handlePWDModeToggle = useCallback(async () => {
    if (!user) return;
    const next = !user.pwdMode;
    togglePWDModeStore();
    try {
      await updateUserProfile(user.uid, {
        pwdMode: next,
        preferences: { ...user.preferences, pwdMode: next },
      });
    } catch {
      // Revert
      togglePWDModeStore();
    }
  }, [user, togglePWDModeStore]);

  /** Sign out: Firebase first, then clear Zustand, then route to login. */
  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutUser();
    } catch {
      /* still clear local state */
    } finally {
      signOutStore();
      setSigningOut(false);
      router.replace('/auth/login');
    }
  }, [signingOut, signOutStore, router]);

  /** Navigate to the rewards store. */
  const handleRewards = useCallback(() => {
    router.push('/rewards/store');
  }, [router]);

  const badges = useMemo(
    () => (user ? badgeRows(user.stats, user.pwdMode, user.streak) : []),
    [user],
  );
  const earnedCount = badges.filter((b) => b.isEarned).length;

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-light dark:bg-surface-dark">
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          Loading profile…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      className="flex-1 bg-surface-light dark:bg-surface-dark"
    >
      <ScrollView
        testID="profile_scroll_view"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — brand + settings glyph */}
        <View className="flex-row items-center justify-between px-4 py-2">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            {user.displayName}
          </Text>
          <Pressable
            testID="profile_settings_button"
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Profile settings"
            hitSlop={8}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              className="text-gray-900 dark:text-white"
            />
          </Pressable>
        </View>

        {/* Photo + name + bio + city */}
        <View className="items-center px-4 pt-2">
          <Pressable
            testID="profile_photo"
            onPress={handleEditPhoto}
            accessibilityRole="button"
            accessibilityLabel="Edit profile photo"
            className="relative"
          >
            <GradientAvatar
              name={user.displayName}
              photoURL={user.photoURL}
              size={96}
              ring
            />
            <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full border-2 border-surface-light bg-primary dark:border-surface-dark">
              <Ionicons
                name={photoUploading ? 'hourglass' : 'pencil'}
                size={12}
                color="#FFFFFF"
              />
            </View>
          </Pressable>

          {user.bio.length > 0 ? (
            <Text
              numberOfLines={3}
              className="mt-3 max-w-xs text-center text-sm text-gray-700 dark:text-gray-200"
            >
              {user.bio}
            </Text>
          ) : null}

          {user.location.length > 0 ? (
            <View className="mt-1 flex-row items-center">
              <Ionicons
                name="location-outline"
                size={12}
                className="text-gray-500 dark:text-gray-400"
              />
              <Text className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                {user.location}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Stats row */}
        <View
          testID="profile_stats_row"
          className="mt-5 flex-row items-center justify-around border-y border-border-light bg-surface-light py-4 dark:border-border-dark dark:bg-surface-dark"
        >
          <StatColumn
            label="Posts"
            value={user.stats.postsCount}
            testID="profile_stat_posts"
          />
          <View className="h-8 w-px bg-border-light dark:bg-border-dark" />
          <StatColumn
            label="Contributions"
            value={
              user.stats.postsCount +
              user.stats.reviewsCount +
              user.stats.placesAdded
            }
            testID="profile_stat_contributions"
          />
          <View className="h-8 w-px bg-border-light dark:bg-border-dark" />
          <StatColumn
            label="Places Visited"
            value={user.stats.placesAdded + user.stats.postsCount}
            testID="profile_stat_places"
          />
        </View>

        {/* Accessibility Impact card */}
        <View className="px-4 pt-5">
          <LinearGradient
            colors={['#7C3AED', '#A855F7', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 8,
              elevation: 6,
            }}
            className="overflow-hidden rounded-3xl p-5"
          >
            <View className="flex-row items-center">
              <MaterialCommunityIcons
                name="account-heart"
                size={22}
                color="#FFFFFF"
              />
              <Text className="ml-2 text-sm font-semibold text-white/90">
                Accessibility Impact
              </Text>
            </View>
            <AnimatedCounter
              value={user.coins}
              className="mt-2 text-white"
            />
            <Text testID="profile_coins_balance_label" className="text-xs text-white/80">
              Total Discova coins earned
            </Text>
            <Text testID="profile_coins_balance" className="sr-only">
              {user.coins}
            </Text>
            <View className="mt-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="h-2 w-2 rounded-full bg-white" />
                <Text className="ml-2 text-xs font-medium text-white/90">
                  Level {user.level}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="trophy" size={12} color="#FFFFFF" />
                <Text className="ml-1 text-xs font-medium text-white/90">
                  {earnedCount} badges
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Badges scroll */}
        <View className="mt-6">
          <View className="mb-2 flex-row items-center justify-between px-4">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              Badges
            </Text>
            <Pressable
              testID="profile_view_all_badges"
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text className="text-xs font-medium text-primary">View all</Text>
            </Pressable>
          </View>
          <ScrollView
            testID="profile_badges_scroll"
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12 }}
          >
            {badges.map((row) => (
              <View key={row.badge.id} style={{ width: 280 }} className="mr-2">
                <BadgeCard
                  badge={row.badge}
                  isEarned={row.isEarned}
                  progress={row.progress}
                  required={row.required}
                />
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Disability Profile card */}
        <View className="px-4 pt-2">
          <View
            testID="profile_disability_card"
            className="rounded-2xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark"
          >
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              Accessibility Profile
            </Text>
            <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Tell Discova about your needs to get tailored recommendations.
            </Text>

            {/* PWD identity toggle */}
            <View className="mt-4 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-sm font-medium text-gray-900 dark:text-white">
                  I identify as a person with a disability
                </Text>
                <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Unlocks personalized picks.
                </Text>
              </View>
              <Switch
                testID="profile_pwd_toggle"
                value={isPWDIdentity}
                onValueChange={handlePWDToggle}
                trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Disability selector chips — animated in when PWD is on */}
            {isPWDIdentity ? (
              <Animated.View
                entering={FadeIn.duration(300)}
                testID="profile_disability_chips"
                className="mt-4"
              >
                <Text className="mb-2 text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  Primary need
                </Text>
                <View className="flex-row flex-wrap">
                  {DISABILITY_CHIPS.map((chip) => {
                    const selected = user.disabilityType === chip.type;
                    return (
                      <Pressable
                        key={chip.label}
                        testID={`profile_disability_chip_${chip.label.toLowerCase()}`}
                        onPress={() => handleChipSelect(chip.type)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        className={`mb-2 mr-2 flex-row items-center rounded-full border-2 px-3 py-1.5 ${
                          selected
                            ? 'border-primary bg-primary-50 dark:bg-primary-900'
                            : 'border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark'
                        }`}
                      >
                        <MaterialCommunityIcons
                          name={chip.icon}
                          size={14}
                          color={selected ? '#6366F1' : '#6B7280'}
                        />
                        <Text
                          className={`ml-1.5 text-xs font-medium ${
                            selected
                              ? 'text-primary-700 dark:text-primary-200'
                              : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {chip.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            ) : null}

            {/* PWD Mode (coin multiplier) toggle */}
            <View className="mt-4 flex-row items-center justify-between border-t border-border-light pt-4 dark:border-border-dark">
              <View className="flex-1 pr-3">
                <Text className="text-sm font-medium text-gray-900 dark:text-white">
                  PWD Mode
                </Text>
                <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Earn 2× coins on every contribution.
                </Text>
              </View>
              <Switch
                testID="profile_pwdmode_toggle"
                value={user.pwdMode}
                onValueChange={handlePWDModeToggle}
                trackColor={{ false: '#D1D5DB', true: '#F59E0B' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Coins card (gold gradient) + Rewards Store CTA */}
        <View className="mt-4 px-4">
          <LinearGradient
            colors={['#F59E0B', '#FBBF24', '#FCD34D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 8,
              elevation: 6,
            }}
            className="overflow-hidden rounded-3xl p-5"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="star-four-points"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text className="ml-2 text-sm font-semibold text-white/90">
                    Discova Coins
                  </Text>
                </View>
                <Text className="mt-2 text-3xl font-bold text-white">
                  {user.coins.toLocaleString()}
                </Text>
                <Text className="mt-0.5 text-xs text-white/80">
                  Spend on partner perks &amp; gear.
                </Text>
              </View>
              <Pressable
                testID="profile_rewards_button"
                onPress={handleRewards}
                accessibilityRole="button"
                accessibilityLabel="Open rewards store"
                className="h-12 flex-row items-center justify-center rounded-2xl bg-white px-4"
              >
                <Ionicons name="gift" size={16} color="#B45309" />
                <Text className="ml-2 text-sm font-semibold text-accent-dark">
                  Rewards
                </Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>

        {/* Photo grid */}
        <View className="mt-6 px-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              Posts
            </Text>
            <View className="flex-row items-center">
              <Ionicons
                name="grid"
                size={16}
                className="text-primary"
              />
            </View>
          </View>
          <View testID="profile_photo_grid" className="flex-row flex-wrap">
            {userPosts.length > 0 ? (
              userPosts.map((p, i) => (
                <Pressable
                  key={p.id}
                  testID={`profile_photo_grid_cell_${i}`}
                  onPress={() => router.push(`/place/${p.placeId}`)}
                  className="w-1/3 p-0.5"
                >
                  <Image
                    source={{ uri: p.imageUrl }}
                    className="aspect-square w-full bg-muted-light dark:bg-muted-dark"
                    resizeMode="cover"
                  />
                </Pressable>
              ))
            ) : (
              <View testID="profile_posts_empty" className="w-full items-center py-12">
                <Ionicons name="camera-outline" size={34} color="#9CA3AF" />
                <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  No posts yet — share a place to fill your grid.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Sign out */}
        <View className="mt-6 px-4">
          <Pressable
            testID="profile_signout_button"
            onPress={handleSignOut}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            className={`h-12 flex-row items-center justify-center rounded-2xl border-2 border-danger bg-surface-light dark:bg-surface-dark ${
              signingOut ? 'opacity-60' : ''
            }`}
          >
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text className="ml-2 text-base font-semibold text-danger">
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
