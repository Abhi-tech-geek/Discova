/**
 * BadgeCard.
 * Visual chip for the rewards / profile screen.
 * - Earned: full-color icon + colored ring.
 * - Locked: grayscale icon + lock overlay + progress bar toward the requirement.
 */

import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { Badge, BadgeRarity } from '../types';

/** Props for `BadgeCard`. */
export interface BadgeCardProps {
  badge: Badge;
  isEarned: boolean;
  /** Progress toward the requirement (0..required). Optional for locked badges. */
  progress?: number;
  /** Total requirement value (matches `progress` units). Optional for locked badges. */
  required?: number;
}

/** Ring color per rarity tier. */
function ringColorForRarity(rarity: BadgeRarity): string {
  if (rarity === 'legendary') return 'border-accent';
  if (rarity === 'epic') return 'border-primary';
  if (rarity === 'rare') return 'border-info';
  return 'border-success';
}

/** Badge text color per rarity. */
function rarityTextColor(rarity: BadgeRarity): string {
  if (rarity === 'legendary') return 'text-accent';
  if (rarity === 'epic') return 'text-primary';
  if (rarity === 'rare') return 'text-info';
  return 'text-success';
}

/** Render the badge card. */
export function BadgeCard({
  badge,
  isEarned,
  progress,
  required,
}: BadgeCardProps) {
  const ring = isEarned
    ? ringColorForRarity(badge.rarity)
    : 'border-border-light dark:border-border-dark';
  const opacity = isEarned ? '' : 'opacity-60';
  const pct =
    typeof progress === 'number' && typeof required === 'number' && required > 0
      ? Math.max(0, Math.min(100, (progress / required) * 100))
      : 0;

  return (
    <View
      testID={`badge_card_${badge.id}`}
      accessibilityRole="text"
      accessibilityLabel={`${badge.name}, ${isEarned ? 'earned' : 'locked'}`}
      className={`mb-3 flex-row items-center rounded-2xl border bg-surface-light p-3 dark:bg-surface-dark ${ring}`}
    >
      {/* Icon disc */}
      <View
        className={`h-14 w-14 items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark ${opacity}`}
      >
        <Text className="text-2xl">{badge.icon}</Text>
        {!isEarned ? (
          <View
            testID={`badge_card_${badge.id}_lock`}
            className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full border-2 border-surface-light bg-gray-700 dark:border-surface-dark"
          >
            <MaterialIcons name="lock" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      {/* Text + progress */}
      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            numberOfLines={1}
            className={`text-base font-semibold text-gray-900 dark:text-white ${opacity}`}
          >
            {badge.name}
          </Text>
          <Text className={`text-xs font-medium uppercase ${rarityTextColor(badge.rarity)}`}>
            {badge.rarity}
          </Text>
        </View>

        <Text
          numberOfLines={2}
          className="mt-0.5 text-xs text-gray-600 dark:text-gray-300"
        >
          {badge.description}
        </Text>

        {!isEarned ? (
          <View className="mt-2">
            <View className="h-1.5 w-full overflow-hidden rounded-full bg-muted-light dark:bg-muted-dark">
              <View
                testID={`badge_card_${badge.id}_progress`}
                style={{ width: `${pct}%` }}
                className="h-1.5 rounded-full bg-primary"
              />
            </View>
            {typeof progress === 'number' && typeof required === 'number' ? (
              <Text className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                {Math.min(progress, required)} / {required} · {badge.requirement}
              </Text>
            ) : (
              <Text className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                {badge.requirement}
              </Text>
            )}
          </View>
        ) : (
          <Text className="mt-1 text-[10px] font-medium text-success">
            +{badge.coinReward} coins earned
          </Text>
        )}
      </View>
    </View>
  );
}
