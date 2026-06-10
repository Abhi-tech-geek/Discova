/**
 * PlaceCard.
 * Horizontal explore-feed card: thumbnail on the left, name + category +
 * distance + accessibility badge on the right.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import type { Place } from '../types';

import { AccessibilityBadge } from './AccessibilityBadge';

/** Props for `PlaceCard`. */
export interface PlaceCardProps {
  place: Place;
  onPress: () => void;
  /** Optional pre-computed distance in km (rendered when provided). */
  distanceKm?: number;
  index: number;
}

/** Format a kilometre value into "320 m", "1.2 km", "12 km". */
function formatDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return '';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

/** Render the place card. */
export function PlaceCard({ place, onPress, distanceKm, index }: PlaceCardProps) {
  const thumb = place.photos[0];
  // Place stores accessibility scores 0-100; the badge takes 0-10.
  const badgeScore = place.accessibilityScores.overall / 10;

  return (
    <Pressable
      testID={`explore_place_card_${index}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${place.name}`}
      className="mb-3 flex-row overflow-hidden rounded-2xl border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark"
    >
      {/* Thumbnail */}
      <View className="h-24 w-24 bg-muted-light dark:bg-muted-dark">
        {thumb ? (
          <Image source={{ uri: thumb }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Ionicons
              name="image-outline"
              size={28}
              className="text-gray-400 dark:text-gray-500"
            />
          </View>
        )}
      </View>

      {/* Body */}
      <View className="flex-1 justify-between p-3">
        <View>
          <Text
            numberOfLines={1}
            className="text-base font-semibold text-gray-900 dark:text-white"
          >
            {place.name}
          </Text>
          <Text
            numberOfLines={1}
            className="mt-0.5 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            {place.category}
          </Text>
          <Text
            numberOfLines={1}
            className="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
          >
            {place.address}
          </Text>
        </View>

        <View className="mt-2 flex-row items-center justify-between">
          {place.accessibilityScores.overall > 0 ? (
            <AccessibilityBadge score={badgeScore} size="sm" />
          ) : (
            <View
              testID="place_card_unanalyzed_icon"
              accessibilityLabel="Accessibility not analyzed yet"
              className="h-7 w-7 items-center justify-center rounded-full bg-muted-light dark:bg-muted-dark"
            >
              <MaterialCommunityIcons
                name="wheelchair-accessibility"
                size={15}
                color="#98A0B0"
              />
            </View>
          )}
          {typeof distanceKm === 'number' ? (
            <View className="flex-row items-center">
              <Ionicons
                name="navigate-outline"
                size={12}
                className="text-gray-500 dark:text-gray-400"
              />
              <Text className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                {formatDistance(distanceKm)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
