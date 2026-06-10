import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from './design/theme';
import { useVisitStore } from '../stores/visitStore';

/**
 * Floating bottom banner shown when the visit tracker decides the user has
 * left a venue (moved ≥3 km away). Prompts them to rate that place's
 * accessibility. Rendered once in the root layout; renders nothing when there
 * is no active nudge.
 */
export function ReviewNudge() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const nudge = useVisitStore((s) => s.reviewNudge);
  const resolveNudge = useVisitStore((s) => s.resolveNudge);

  if (!nudge) return null;

  /** Open the review form for the visited place, then clear the nudge. */
  const handleRate = () => {
    const target = nudge;
    resolveNudge();
    router.push({
      pathname: '/review/[placeId]',
      params: { placeId: target.placeId || target.name, name: target.name },
    });
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
    >
      <Animated.View
        entering={FadeInUp.springify().damping(18)}
        exiting={FadeOutDown.duration(180)}
        testID="review_nudge"
        style={{
          marginBottom: insets.bottom + 76,
          marginHorizontal: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 8,
        }}
        className="flex-row items-center rounded-2xl border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/15">
          <Ionicons name="location" size={20} color={COLORS.brand} />
        </View>

        <View className="ml-3 flex-1 pr-2">
          <Text
            numberOfLines={1}
            className="text-sm font-semibold text-gray-900 dark:text-white"
          >
            Rate {nudge.name}?
          </Text>
          <Text numberOfLines={2} className="text-xs text-gray-500 dark:text-gray-400">
            You were just here — share its accessibility to help others.
          </Text>
        </View>

        <Pressable
          testID="review_nudge_later"
          onPress={resolveNudge}
          accessibilityRole="button"
          accessibilityLabel="Dismiss review prompt"
          hitSlop={6}
          className="px-2 py-2"
        >
          <Text className="text-xs font-medium text-gray-400">Later</Text>
        </Pressable>
        <Pressable
          testID="review_nudge_rate"
          onPress={handleRate}
          accessibilityRole="button"
          accessibilityLabel={`Rate ${nudge.name}`}
          className="ml-1 rounded-full bg-primary px-3.5 py-2"
        >
          <Text className="text-xs font-semibold text-white">Rate</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
