import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AURORA, COLORS } from '../../components/design/theme';
import { addCoinsToUser, createReview, getCurrentUser } from '../../services/firebase';
import { useUserStore } from '../../stores/userStore';
import type { ReviewAccessibilityRatings } from '../../types';
import { sanitizeInput } from '../../utils/sanitize';

/** The five accessibility dimensions a reviewer rates (0 = skipped). */
const CATEGORY_ROWS: Array<{
  key: keyof ReviewAccessibilityRatings;
  label: string;
  hint: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: 'mobility', label: 'Wheelchair / Mobility', hint: 'Ramps, lifts, wide doors', icon: 'wheelchair-accessibility' },
  { key: 'visual', label: 'Visual / Low vision', hint: 'Braille, tactile paths, lighting', icon: 'eye-outline' },
  { key: 'hearing', label: 'Hearing', hint: 'Signage, sign language, alerts', icon: 'ear-hearing' },
  { key: 'cognitive', label: 'Cognitive / Wayfinding', hint: 'Clear signs, easy layout', icon: 'head-cog-outline' },
  { key: 'sensory', label: 'Sensory / Calm', hint: 'Noise, crowd, quiet zones', icon: 'waveform' },
];

const EMPTY_RATINGS: ReviewAccessibilityRatings = {
  mobility: 0,
  visual: 0,
  hearing: 0,
  cognitive: 0,
  sensory: 0,
};

/** Row of five tappable stars (0-5). Tapping the active star clears to 0. */
function Stars({
  value,
  onChange,
  testIDPrefix,
  size = 26,
}: {
  value: number;
  onChange: (next: number) => void;
  testIDPrefix: string;
  size?: number;
}) {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          testID={`${testIDPrefix}_${n}`}
          onPress={() => onChange(n === value ? 0 : n)}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
          hitSlop={6}
          className="px-0.5"
        >
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={size}
            color={n <= value ? COLORS.coin : '#9CA3AF'}
          />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Accessibility review form.
 * A signed-in user rates a place's overall experience (1-5) plus up to five
 * accessibility dimensions, adds an optional note, and submits. The review is
 * written to Firestore (`createReview`) and the user is awarded coins
 * (2× in PWD mode) toward the shared accessibility database.
 */
export default function AccessibilityReviewScreen() {
  const router = useRouter();
  const { placeId, name } = useLocalSearchParams<{ placeId: string; name?: string }>();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  const [overall, setOverall] = useState(0);
  const [ratings, setRatings] = useState<ReviewAccessibilityRatings>(EMPTY_RATINGS);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const reward = user?.pwdMode ? 40 : 20;
  const canSubmit = overall > 0 && !saving;

  /** Update one accessibility category's 0-5 rating. */
  const setCategory = useCallback(
    (key: keyof ReviewAccessibilityRatings, next: number) => {
      setRatings((prev) => ({ ...prev, [key]: next }));
    },
    [],
  );

  /** Validate, write the review to Firestore, award coins, and go back. */
  const handleSubmit = useCallback(async () => {
    if (!user || overall === 0 || saving) return;
    setSaving(true);
    try {
      const fbUser = getCurrentUser();
      const uid = fbUser?.uid ?? user.uid;
      await createReview({
        userId: uid,
        userDisplayName: user.displayName,
        placeId: placeId ?? '',
        rating: overall,
        text: sanitizeInput(text, 500),
        accessibilityRatings: ratings,
        photos: [],
      });

      // Award coins (persist to Firestore only for a real Firebase user).
      if (fbUser) {
        void addCoinsToUser(fbUser.uid, reward, 'review_created').catch(() => {
          /* coin write is best-effort */
        });
      }
      setUser({
        ...user,
        coins: user.coins + reward,
        stats: { ...user.stats, reviewsCount: user.stats.reviewsCount + 1 },
      });

      Alert.alert('Review posted', `Thanks for helping others! +${reward} coins earned.`, [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Could not post', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }, [user, overall, text, ratings, placeId, reward, setUser, router, saving]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg dark:bg-surface-dark">
      {/* Header */}
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          testID="review_back"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark"
        >
          <Ionicons name="arrow-back" size={20} className="text-gray-900 dark:text-white" />
        </Pressable>
        <View className="ml-2 flex-1">
          <Text className="text-lg font-bold text-gray-900 dark:text-white">
            Accessibility review
          </Text>
          {name ? (
            <Text numberOfLines={1} className="text-xs text-gray-500 dark:text-gray-400">
              {name}
            </Text>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          testID="review_scroll"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Overall */}
          <View className="mb-4 rounded-2xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-sm font-bold text-gray-900 dark:text-white">
              Overall experience
            </Text>
            <Text className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              How was your visit overall?
            </Text>
            <Stars value={overall} onChange={setOverall} testIDPrefix="review_overall_star" size={34} />
          </View>

          {/* Accessibility dimensions */}
          <View className="mb-4 rounded-2xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-sm font-bold text-gray-900 dark:text-white">
              Accessibility ratings
            </Text>
            <Text className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Rate what you saw. Skip anything you're not sure about.
            </Text>

            {CATEGORY_ROWS.map((row, i) => (
              <View
                key={row.key}
                className={`flex-row items-center py-3 ${
                  i === CATEGORY_ROWS.length - 1
                    ? ''
                    : 'border-b border-border-light dark:border-border-dark'
                }`}
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark">
                  <MaterialCommunityIcons name={row.icon} size={18} color={COLORS.brand} />
                </View>
                <View className="ml-3 flex-1 pr-2">
                  <Text className="text-sm font-medium text-gray-900 dark:text-white">
                    {row.label}
                  </Text>
                  <Text className="text-[11px] text-gray-400 dark:text-gray-500">{row.hint}</Text>
                </View>
                <Stars
                  value={ratings[row.key]}
                  onChange={(next) => setCategory(row.key, next)}
                  testIDPrefix={`review_${row.key}_star`}
                  size={20}
                />
              </View>
            ))}
          </View>

          {/* Note */}
          <View className="mb-4 rounded-2xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark">
            <Text className="mb-2 text-sm font-bold text-gray-900 dark:text-white">
              Your review <Text className="text-gray-400">(optional)</Text>
            </Text>
            <TextInput
              testID="review_text_input"
              value={text}
              onChangeText={setText}
              placeholder="What should others know? e.g. ramp at the side entrance, lift to all floors…"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              className="min-h-[88px] text-sm leading-5 text-gray-900 dark:text-white"
              textAlignVertical="top"
            />
            <Text className="mt-1 text-right text-[11px] text-gray-400">{text.length}/500</Text>
          </View>

          {/* Reward hint */}
          <View className="mb-2 flex-row items-center justify-center">
            <MaterialCommunityIcons name="hand-coin-outline" size={15} color={COLORS.coin} />
            <Text className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
              Earn <Text className="font-semibold text-gray-700 dark:text-gray-200">+{reward} coins</Text>
              {user?.pwdMode ? ' (2× PWD bonus)' : ''} for this review
            </Text>
          </View>
        </ScrollView>

        {/* Submit */}
        <SafeAreaView edges={['bottom']} className="bg-bg dark:bg-surface-dark">
          <View className="px-4 pb-3 pt-2">
            <Pressable
              testID="review_submit_button"
              onPress={handleSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              className="overflow-hidden rounded-2xl"
            >
              {canSubmit ? (
                <LinearGradient
                  colors={[...AURORA]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="flex-row items-center justify-center py-3.5"
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text className="ml-2 text-base font-semibold text-white">Post review</Text>
                </LinearGradient>
              ) : (
                <View className="flex-row items-center justify-center bg-muted-light py-3.5 dark:bg-muted-dark">
                  {saving ? (
                    <ActivityIndicator size="small" color={COLORS.brand} />
                  ) : (
                    <Text className="text-base font-semibold text-gray-400 dark:text-gray-500">
                      Tap a star to rate
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
