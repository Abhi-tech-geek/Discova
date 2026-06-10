/**
 * HomePlaceCard — the home "Near you" discovery card.
 * Big real Google photo + name overlay, with a row of live signals: a
 * crowd/quiet meter, Google rating, distance, and the accessibility score
 * (once the place has been analysed).
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, Text, View } from 'react-native';

import { ScorePill } from './design/ScorePill';
import { COLORS } from './design/theme';
import { CrowdMeter } from './CrowdMeter';
import { estimateCrowd } from '../utils/crowd';
import { isHiddenGem } from '../utils/place';
import type { Place } from '../types';

export interface HomePlaceCardProps {
  place: Place;
  distanceKm?: number;
  onPress: () => void;
  index: number;
}

/** "320 m" / "1.2 km" / "12 km". */
function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function HomePlaceCard({ place, distanceKm, onPress, index }: HomePlaceCardProps) {
  const photo = place.photos[0];
  const crowd = estimateCrowd({
    category: place.category,
    totalReviews: place.totalReviews,
    aiAnalysis: place.aiAnalysis,
  });
  const analysed = place.accessibilityScores.overall > 0;
  const gem = isHiddenGem(place.rating, place.totalReviews);

  return (
    <Pressable
      testID={`home_place_card_${index}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${place.name}`}
      className="mx-3.5 mb-4 overflow-hidden rounded-3xl border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark"
    >
      {/* Photo */}
      <View style={{ width: '100%', aspectRatio: 16 / 10, backgroundColor: COLORS.surface2 }}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Ionicons name="image-outline" size={30} color={COLORS.ink3} />
          </View>
        )}

        {/* Hidden gem badge */}
        {gem ? (
          <View
            testID={`home_place_card_${index}_gem`}
            style={{ backgroundColor: 'rgba(122,61,245,0.92)' }}
            className="absolute left-3 top-3 flex-row items-center rounded-full px-2 py-1"
          >
            <Ionicons name="diamond" size={10} color="#FFFFFF" />
            <Text className="ml-1 text-[10px] font-bold text-white">Hidden gem</Text>
          </View>
        ) : null}

        {/* Rating chip */}
        {place.rating > 0 ? (
          <View
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            className="absolute right-3 top-3 flex-row items-center rounded-full px-2 py-1"
          >
            <Ionicons name="star" size={11} color="#FFC93C" />
            <Text className="ml-1 text-xs font-bold text-white">{place.rating.toFixed(1)}</Text>
          </View>
        ) : null}

        {/* Bottom overlay: name + category */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 36, paddingBottom: 12 }}
        >
          <Text
            numberOfLines={1}
            style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '800', letterSpacing: -0.5 }}
          >
            {place.name}
          </Text>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1 }}>
            {place.category}
          </Text>
        </LinearGradient>
      </View>

      {/* Signals row */}
      <View className="flex-row items-center justify-between px-3.5 py-3">
        <CrowdMeter estimate={crowd} size="sm" />

        <View className="flex-row items-center" style={{ gap: 10 }}>
          {typeof distanceKm === 'number' ? (
            <View className="flex-row items-center" style={{ gap: 3 }}>
              <Ionicons name="navigate-outline" size={12} color={COLORS.ink3} />
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {formatDistance(distanceKm)}
              </Text>
            </View>
          ) : null}

          {analysed ? (
            <ScorePill score={place.accessibilityScores.overall} size="sm" />
          ) : (
            <View className="flex-row items-center rounded-full bg-primary/10 px-2 py-1" style={{ gap: 3 }}>
              <Ionicons name="accessibility" size={11} color={COLORS.brand} />
              <Text className="text-[11px] font-semibold text-primary">Check access</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
