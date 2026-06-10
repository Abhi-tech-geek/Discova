/**
 * ComfortCard — the Universal Comfort Index for a place: an overall 0-100 score
 * plus four factor bars (parking, walking, seating, calm). For everyone, not
 * just disabled visitors.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { COLORS } from './design/theme';
import { comfortIndex, type ComfortFactors, type ComfortInput } from '../utils/comfort';

const FACTORS: Array<{ key: keyof ComfortFactors; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'parking', label: 'Easy parking', icon: 'car-outline' },
  { key: 'walking', label: 'Less walking', icon: 'walk' },
  { key: 'seating', label: 'Seating', icon: 'seat-outline' },
  { key: 'calm', label: 'Calm', icon: 'leaf' },
];

/** Green / amber / red by value. */
function tone(v: number): string {
  if (v >= 70) return COLORS.aHigh;
  if (v >= 45) return COLORS.aMid;
  return COLORS.aLow;
}

export function ComfortCard({ input, testID }: { input: ComfortInput; testID?: string }) {
  const ci = comfortIndex(input);

  return (
    <View
      testID={testID}
      className="rounded-2xl border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <MaterialCommunityIcons name="sofa-outline" size={16} color={COLORS.brand} />
          <Text className="text-sm font-bold text-gray-900 dark:text-white">Comfort Index</Text>
        </View>
        <View className="flex-row items-baseline" style={{ gap: 2 }}>
          <Text style={{ color: tone(ci.score), fontWeight: '800', fontSize: 18 }}>{ci.score}</Text>
          <Text className="text-xs text-gray-400">/100</Text>
        </View>
      </View>
      <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {ci.label} for most visitors
      </Text>

      <View className="mt-2.5">
        {FACTORS.map((f) => {
          const v = ci.factors[f.key];
          return (
            <View key={f.key} className="mb-2 flex-row items-center">
              <MaterialCommunityIcons name={f.icon} size={14} color={COLORS.ink3} />
              <Text className="ml-2 text-xs text-gray-600 dark:text-gray-300" style={{ width: 88 }}>
                {f.label}
              </Text>
              <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted-light dark:bg-muted-dark">
                <View style={{ width: `${v}%`, backgroundColor: tone(v) }} className="h-full rounded-full" />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
