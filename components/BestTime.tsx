/**
 * BestTime — "best time to visit" widget. Shows a typical-busyness bar strip
 * across the day (8 AM–9 PM) for a place's category, highlighting the quietest
 * window. Time-heuristic only (see utils/crowd.dayBusyness). Great for
 * sensory-sensitive users and anyone who wants to skip the rush.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { COLORS } from './design/theme';
import { dayBusyness } from '../utils/crowd';

const UNFILLED = 'rgba(150,160,176,0.40)';

export function BestTime({ category, testID }: { category: string; testID?: string }) {
  const { hours, quietest } = dayBusyness(category);

  return (
    <View
      testID={testID}
      className="rounded-2xl border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <MaterialCommunityIcons name="clock-time-four-outline" size={15} color={COLORS.brand} />
        <Text className="text-sm font-bold text-gray-900 dark:text-white">Best time to visit</Text>
      </View>
      <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        Usually quietest around{' '}
        <Text className="font-bold text-success">{quietest.label}</Text>
      </Text>

      {/* Hourly bars */}
      <View className="mt-3 flex-row items-end justify-between" style={{ height: 42 }}>
        {hours.map(({ hour, level }) => {
          const quiet = hour >= quietest.startHour && hour < quietest.startHour + 2;
          return (
            <View key={hour} style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  width: 6,
                  height: Math.max(4, (level / 100) * 38),
                  borderRadius: 3,
                  backgroundColor: quiet ? COLORS.aHigh : UNFILLED,
                }}
              />
            </View>
          );
        })}
      </View>

      <View className="mt-1 flex-row justify-between">
        <Text className="text-[9px] text-gray-400">8 AM</Text>
        <Text className="text-[9px] text-gray-400">2 PM</Text>
        <Text className="text-[9px] text-gray-400">9 PM</Text>
      </View>
    </View>
  );
}
