/**
 * NativeMap (web fallback).
 *
 * react-native-maps has no usable web implementation, so on web we render a
 * branded placeholder instead of a real map. `Marker` becomes a no-op and
 * `PROVIDER_GOOGLE` is undefined. Refs stay null (plain function component),
 * so any `mapRef.current?.animateToRegion(...)` calls short-circuit safely.
 */
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS } from './theme';

export interface WebMapViewProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Web placeholder standing in for the native MapView. */
export function MapView({ children, style, testID }: WebMapViewProps) {
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: COLORS.bg2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name="map-outline" size={40} color={COLORS.ink3} />
      <Text style={{ marginTop: 8, color: COLORS.ink2, fontWeight: '600', fontSize: 13 }}>
        Map view mobile app pe available hai
      </Text>
      <Text style={{ marginTop: 2, color: COLORS.ink3, fontSize: 11 }}>
        Switch to list view to browse places here.
      </Text>
      {children}
    </View>
  );
}

/** No-op marker for web — markers only render on the native map. */
export function Marker(_props: { children?: ReactNode; [key: string]: unknown }) {
  return null;
}

/** No provider concept on web. */
export const PROVIDER_GOOGLE = undefined;

export default MapView;
