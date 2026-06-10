/**
 * CrowdMeter — compact "how busy / noisy right now" indicator.
 * Renders an estimate from `utils/crowd.estimateCrowd`. Two sizes: a small
 * inline pill for cards, and a fuller row for the place detail screen.
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { COLORS } from './design/theme';
import type { CrowdEstimate } from '../utils/crowd';

const UNFILLED = 'rgba(150,160,176,0.32)';

/** Accent colour for a crowd level. */
function crowdColor(crowd: CrowdEstimate['crowd']): string {
  if (crowd === 'busy') return COLORS.aLow;
  if (crowd === 'quiet') return COLORS.aHigh;
  return COLORS.aMid;
}

/** Ionicons volume glyph for a noise level. */
function noiseIcon(noise: CrowdEstimate['noise']): keyof typeof Ionicons.glyphMap {
  if (noise === 'high') return 'volume-high';
  if (noise === 'low') return 'volume-low';
  return 'volume-medium';
}

/** Three rising bars; `filled` of them coloured. */
function Bars({ filled, color }: { filled: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: 6 + i * 3,
            borderRadius: 1.5,
            backgroundColor: i < filled ? color : UNFILLED,
          }}
        />
      ))}
    </View>
  );
}

export interface CrowdMeterProps {
  estimate: CrowdEstimate;
  size?: 'sm' | 'md';
  testID?: string;
}

export function CrowdMeter({ estimate, size = 'sm', testID }: CrowdMeterProps) {
  const color = crowdColor(estimate.crowd);
  const filled = estimate.crowd === 'busy' ? 3 : estimate.crowd === 'moderate' ? 2 : 1;

  if (size === 'sm') {
    return (
      <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Bars filled={filled} color={color} />
        <Text style={{ fontSize: 11, fontWeight: '700', color }}>{estimate.label}</Text>
        <Ionicons name={noiseIcon(estimate.noise)} size={12} color={COLORS.ink3} />
      </View>
    );
  }

  // md — fuller row for the place detail screen.
  const noiseLabel =
    estimate.noise === 'high' ? 'Loud' : estimate.noise === 'low' ? 'Quiet' : 'Moderate';
  return (
    <View
      testID={testID}
      className="flex-row items-center rounded-2xl border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <View
        style={{ backgroundColor: `${color}1F` }}
        className="h-9 w-9 items-center justify-center rounded-full"
      >
        <MaterialCommunityIcons name="account-group" size={18} color={color} />
      </View>
      <View className="ml-3 flex-1">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text className="text-sm font-bold text-gray-900 dark:text-white">{estimate.label}</Text>
          <Bars filled={filled} color={color} />
        </View>
        <View className="mt-0.5 flex-row items-center" style={{ gap: 4 }}>
          <Ionicons name={noiseIcon(estimate.noise)} size={13} color={COLORS.ink3} />
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {noiseLabel} noise · {estimate.hasSignal ? 'from photos' : 'estimated'}
          </Text>
        </View>
      </View>
    </View>
  );
}
