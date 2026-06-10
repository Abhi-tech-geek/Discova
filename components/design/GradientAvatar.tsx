/**
 * Avatar with a gradient initial monogram. Optional aurora ring for unseen
 * stories or a "you can add" plus pip.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Text, View } from 'react-native';

import { AURORA, AVATAR_GRADIENTS, COLORS } from './theme';

export interface GradientAvatarProps {
  /** Display name for monogram fallback. */
  name: string;
  /** Photo URL — overrides monogram when present. */
  photoURL?: string | null;
  /** Stable seed so repeats keep the same color. */
  seed?: number;
  size?: number;
  /** When true, wrap in an aurora ring (unseen-story style). */
  ring?: boolean;
  /** When true, the ring is gray (already seen / own placeholder). */
  ringSeen?: boolean;
  /** Show a "+" pip in the bottom-right for the "Add to your story" affordance. */
  addPip?: boolean;
}

/** Strip a name to up to two uppercase initial letters. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

export function GradientAvatar({
  name,
  photoURL,
  seed = 0,
  size = 42,
  ring = false,
  ringSeen = false,
  addPip = false,
}: GradientAvatarProps) {
  const pair = AVATAR_GRADIENTS[seed % AVATAR_GRADIENTS.length] ?? AVATAR_GRADIENTS[0];

  const inner = photoURL ? (
    <Image
      source={{ uri: photoURL }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS.surface2 }}
    />
  ) : (
    <LinearGradient
      colors={[pair[0], pair[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontWeight: '800',
          fontSize: size * 0.36,
          letterSpacing: -0.5,
        }}
      >
        {initials(name) || '?'}
      </Text>
    </LinearGradient>
  );

  if (!ring && !addPip) {
    return <View>{inner}</View>;
  }

  return (
    <View style={{ position: 'relative' }}>
      {ring ? (
        ringSeen ? (
          <View
            style={{
              padding: 2.5,
              borderRadius: (size + 7) / 2,
              backgroundColor: COLORS.hairline2,
            }}
          >
            <View
              style={{
                padding: 2,
                borderRadius: (size + 4) / 2,
                backgroundColor: COLORS.surface,
              }}
            >
              {inner}
            </View>
          </View>
        ) : (
          <LinearGradient
            colors={[...AURORA]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              padding: 2.5,
              borderRadius: (size + 7) / 2,
            }}
          >
            <View
              style={{
                padding: 2,
                borderRadius: (size + 4) / 2,
                backgroundColor: COLORS.surface,
              }}
            >
              {inner}
            </View>
          </LinearGradient>
        )
      ) : (
        inner
      )}

      {addPip ? (
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: 21,
            height: 21,
            borderRadius: 999,
            backgroundColor: COLORS.brand,
            borderWidth: 2.5,
            borderColor: COLORS.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={12} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}
