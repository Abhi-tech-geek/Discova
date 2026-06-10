/**
 * Accessibility-feature chip — icon + label + optional verified check.
 * State drives the color: `verified` → green, `detected` → neutral, `no` → red.
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { COLORS } from './theme';

export type FeatureKey =
  | 'ramp'
  | 'lift'
  | 'stepfree'
  | 'wc'
  | 'light'
  | 'wheelchair'
  | 'audio'
  | 'vision'
  | 'stairs'
  | 'parking';

export type FeatureState = 'verified' | 'detected' | 'no';

interface FeatureMeta {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
}

const FEAT_META: Record<FeatureKey, FeatureMeta> = {
  ramp: { icon: 'stairs-up', label: 'Ramp' },
  lift: { icon: 'elevator-passenger', label: 'Lift' },
  stepfree: { icon: 'shoe-print', label: 'Step-free' },
  wc: { icon: 'human-male-female', label: 'Accessible WC' },
  light: { icon: 'lightbulb-on-outline', label: 'Good lighting' },
  wheelchair: { icon: 'wheelchair-accessibility', label: 'Wheelchair' },
  audio: { icon: 'ear-hearing', label: 'Hearing loop' },
  vision: { icon: 'eye-outline', label: 'Braille / signage' },
  stairs: { icon: 'stairs', label: 'Stairs only' },
  parking: { icon: 'parking', label: 'Accessible parking' },
};

export interface FeatureChipProps {
  feat: FeatureKey;
  state?: FeatureState;
  small?: boolean;
}

export function FeatureChip({ feat, state = 'detected', small = false }: FeatureChipProps) {
  const meta = FEAT_META[feat];
  const color =
    state === 'verified' ? COLORS.aHigh : state === 'no' ? COLORS.aLow : COLORS.ink2;
  const bg =
    state === 'verified' ? COLORS.aHighBg : state === 'no' ? COLORS.aLowBg : COLORS.surface2;

  return (
    <View
      testID={`design_feature_chip_${feat}_${state}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: small ? 9 : 11,
        paddingVertical: small ? 4 : 6,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: COLORS.hairline,
      }}
    >
      <MaterialCommunityIcons name={meta.icon} size={small ? 14 : 16} color={color} />
      <Text style={{ color, fontWeight: '600', fontSize: small ? 11.5 : 12.5 }}>
        {meta.label}
      </Text>
      {state === 'verified' ? (
        <Ionicons
          name="checkmark"
          size={small ? 12 : 13}
          color={COLORS.aHigh}
          style={{ marginLeft: 1 }}
        />
      ) : null}
    </View>
  );
}
