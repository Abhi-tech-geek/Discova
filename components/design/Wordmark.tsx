/**
 * DISCOVA wordmark.
 *
 * A custom "locator" brand mark — an aurora-gradient squircle holding a white
 * GPS-crosshair (ring + cross + centre dot), which reads as "find accessible
 * places" rather than a generic map pin — paired with the "Discova" wordtext.
 *
 * Built from plain Views + LinearGradient (no SVG dependency).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { AURORA } from './theme';
import { useAppStore } from '../../stores/appStore';

export interface WordmarkProps {
  /** Font size of the word; the mark scales with it. */
  size?: number;
  /** Hide the "Discova" text and render only the mark. */
  markOnly?: boolean;
  /** Force white text (for use on dark / gradient backgrounds). */
  light?: boolean;
}

/** The standalone aurora locator mark (also reusable as an app-style tile). */
export function WordmarkMark({ size = 32 }: { size?: number }) {
  const T = size;
  const line = 'rgba(255,255,255,0.95)';
  return (
    <LinearGradient
      colors={[...AURORA]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: T,
        height: T,
        borderRadius: T * 0.31,
        shadowColor: '#2E6BFF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 9,
        elevation: 4,
      }}
    >
      {/* Locator ring */}
      <View
        style={{
          position: 'absolute',
          top: T * 0.22,
          left: T * 0.22,
          right: T * 0.22,
          bottom: T * 0.22,
          borderRadius: T * 0.3,
          borderWidth: Math.max(1.5, T * 0.07),
          borderColor: line,
        }}
      />
      {/* Crosshair — vertical + horizontal */}
      <View
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: -1,
          top: T * 0.1,
          bottom: T * 0.1,
          width: 2,
          borderRadius: 1,
          backgroundColor: line,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: '50%',
          marginTop: -1,
          left: T * 0.1,
          right: T * 0.1,
          height: 2,
          borderRadius: 1,
          backgroundColor: line,
        }}
      />
      {/* Centre dot */}
      <View
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: T * 0.2,
          height: T * 0.2,
          marginLeft: -(T * 0.1),
          marginTop: -(T * 0.1),
          borderRadius: T * 0.1,
          backgroundColor: '#FFFFFF',
        }}
      />
    </LinearGradient>
  );
}

export function Wordmark({ size = 22, markOnly = false, light = false }: WordmarkProps) {
  const isDark = useAppStore((s) => s.theme === 'dark');
  // Inline `color` overrides NativeWind className, so resolve it ourselves.
  const textColor = light || isDark ? '#FFFFFF' : '#13161C';
  return (
    <View
      testID="design_wordmark"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <WordmarkMark size={size + 11} />
      {markOnly ? null : (
        <Text style={{ fontSize: size, fontWeight: '800', letterSpacing: -0.6, color: textColor }}>
          Discova
        </Text>
      )}
    </View>
  );
}
