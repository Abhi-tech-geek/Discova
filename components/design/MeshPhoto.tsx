/**
 * Mesh-gradient placeholder photo.
 * On RN we can't render a real CSS mesh gradient — instead we stack three
 * LinearGradients at offsetting angles to approximate the look. Real photos
 * (via `photoURL`) take precedence and the mesh shows through as the
 * loading background.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { paletteFor } from './theme';

export interface MeshPhotoProps {
  /** Category (cafe / mall / park / monument / etc.) — drives the palette. */
  category: string;
  /** Stable seed (e.g. id hash) so the same place looks the same every render. */
  seed?: number;
  /** Optional real photo URL — drawn on top of the mesh. */
  photoURL?: string | null;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** Hash a string to a small positive integer for deterministic seeds. */
export function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function MeshPhoto({
  category,
  seed = 0,
  photoURL,
  style,
  children,
}: MeshPhotoProps) {
  const [a, b, c] = paletteFor(category);
  const angle = 120 + (seed * 37) % 80;

  return (
    <View style={[{ overflow: 'hidden', position: 'relative' }, style]}>
      {/* Base gradient — sits behind everything. */}
      <LinearGradient
        colors={[b, a, c]}
        start={{ x: 0, y: 0 }}
        end={{ x: Math.cos((angle * Math.PI) / 180), y: Math.sin((angle * Math.PI) / 180) }}
        style={{ position: 'absolute', inset: 0 }}
      />
      {/* Soft top-left tint */}
      <LinearGradient
        colors={[a, 'transparent']}
        start={{ x: 0.2, y: 0.18 }}
        end={{ x: 0.9, y: 0.9 }}
        style={{ position: 'absolute', inset: 0, opacity: 0.65 }}
      />
      {/* Vignette bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.28)']}
        start={{ x: 0.5, y: 0.6 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={{ position: 'absolute', inset: 0 }}
          resizeMode="cover"
        />
      ) : null}
      {children}
    </View>
  );
}
