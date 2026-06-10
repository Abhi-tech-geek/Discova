/**
 * AccessibilityBadge.
 * Pill showing a 0-10 accessibility score with traffic-light color and a
 * wheelchair icon. Re-used across Post, Place, and Review cards.
 */

import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

/** Visual size variants. */
export type AccessibilityBadgeSize = 'sm' | 'md' | 'lg';

/** Props for `AccessibilityBadge`. */
export interface AccessibilityBadgeProps {
  /** Accessibility score on a 0-10 scale. */
  score: number;
  /** Visual size, defaults to 'md'. */
  size?: AccessibilityBadgeSize;
}

/** Pick the traffic-light bg class for a 0-10 score. */
function bgForScore(score: number): string {
  if (score >= 7) return 'bg-success';
  if (score >= 4) return 'bg-warning';
  return 'bg-danger';
}

/** Container/text/icon sizing for the three variants. */
function sizing(size: AccessibilityBadgeSize): {
  container: string;
  text: string;
  icon: number;
} {
  if (size === 'sm') return { container: 'h-6 px-2', text: 'text-xs', icon: 12 };
  if (size === 'lg') return { container: 'h-10 px-4', text: 'text-base', icon: 22 };
  return { container: 'h-8 px-3', text: 'text-sm', icon: 16 };
}

/** Render the badge. */
export function AccessibilityBadge({ score, size = 'md' }: AccessibilityBadgeProps) {
  const clamped = Math.max(0, Math.min(10, score));
  const { container, text, icon } = sizing(size);
  const bg = bgForScore(clamped);

  return (
    <View
      testID={`accessibility_badge_${clamped}`}
      accessibilityRole="text"
      accessibilityLabel={`Accessibility score ${clamped.toFixed(1)} out of 10`}
      className={`flex-row items-center rounded-full ${bg} ${container} dark:opacity-95`}
    >
      <MaterialIcons name="accessible" size={icon} color="#FFFFFF" />
      <Text className={`ml-1.5 font-semibold text-white ${text}`}>
        {clamped.toFixed(1)}
      </Text>
    </View>
  );
}
