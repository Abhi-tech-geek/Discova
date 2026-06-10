/**
 * Compact pill showing an accessibility score with traffic-light tint.
 * Replaces the previous AccessibilityBadge visual on cards / detail screens.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { tierFor } from './theme';

export interface ScorePillProps {
  /** 0-100 score. */
  score: number;
  size?: 'sm' | 'md';
}

export function ScorePill({ score, size = 'md' }: ScorePillProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const t = tierFor(clamped);

  return (
    <View
      testID={`design_score_pill_${clamped}`}
      accessibilityLabel={`Accessibility score ${clamped} out of 100, ${t.word}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: size === 'sm' ? 8 : 10,
        paddingVertical: size === 'sm' ? 3 : 5,
        borderRadius: 999,
        backgroundColor: t.bg,
        alignSelf: 'flex-start',
      }}
    >
      <MaterialCommunityIcons
        name="wheelchair-accessibility"
        size={size === 'sm' ? 13 : 15}
        color={t.color}
      />
      <Text
        style={{
          color: t.color,
          fontWeight: '700',
          fontSize: size === 'sm' ? 12 : 13,
          lineHeight: size === 'sm' ? 14 : 16,
        }}
      >
        {clamped}
      </Text>
    </View>
  );
}
