/**
 * StoryCircle.
 * Avatar circle with an Instagram-style gradient ring when the user has an
 * unseen story. Reanimated scale-down on press. Renders an "Add" pip when
 * `isOwn` is true.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { User } from '../types';

/** Minimal user projection the StoryCircle needs to render. */
export type StoryCircleUser = Pick<User, 'uid' | 'displayName' | 'photoURL'>;

/** Props for `StoryCircle`. */
export interface StoryCircleProps {
  user: StoryCircleUser;
  isOwn: boolean;
  hasUnseenStory: boolean;
  onPress: () => void;
  index: number;
}

const GRADIENT_COLORS = ['#F58529', '#DD2A7B', '#8134AF', '#515BD4'] as const;
const SEEN_GRADIENT = ['#D1D5DB', '#D1D5DB'] as const;

/** Render the story circle. */
export function StoryCircle({
  user,
  isOwn,
  hasUnseenStory,
  onPress,
  index,
}: StoryCircleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  /** Press-in: shrink for tactile feedback. */
  const handlePressIn = (): void => {
    scale.value = withTiming(0.92, { duration: 90 });
  };

  /** Press-out: snap back. */
  const handlePressOut = (): void => {
    scale.value = withTiming(1, { duration: 120 });
  };

  const ringColors = hasUnseenStory ? GRADIENT_COLORS : SEEN_GRADIENT;
  const firstName = user.displayName.split(' ')[0] ?? user.displayName;

  return (
    <Pressable
      testID={`home_story_circle_${index}`}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={isOwn ? 'Your story' : `${user.displayName}'s story`}
      className="items-center w-20"
    >
      <Animated.View style={animatedStyle} className="items-center">
        <LinearGradient
          colors={[...ringColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="h-20 w-20 items-center justify-center rounded-full p-[3px]"
        >
          <View className="h-full w-full items-center justify-center rounded-full bg-surface-light p-[2px] dark:bg-surface-dark">
            {user.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                className="h-full w-full rounded-full"
              />
            ) : (
              <View className="h-full w-full items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark">
                <Text className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                  {firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {isOwn ? (
          <View
            testID={`home_story_circle_${index}_add`}
            className="absolute bottom-0 right-0 h-6 w-6 items-center justify-center rounded-full border-2 border-surface-light bg-primary dark:border-surface-dark"
          >
            <Ionicons name="add" size={14} color="#FFFFFF" />
          </View>
        ) : null}
      </Animated.View>

      <Text
        numberOfLines={1}
        className="mt-1 text-xs text-gray-700 dark:text-gray-300"
      >
        {isOwn ? 'Your story' : firstName}
      </Text>
    </Pressable>
  );
}
