/**
 * Reusable Card container.
 * Pure visual wrapper with `variant` (visual style), `padding`, and dark-mode
 * aware backgrounds. Use this anywhere we'd otherwise repeat the
 * `rounded-2xl border bg-surface-* p-4` recipe.
 */

import { Pressable, Text, View } from 'react-native';

/** Visual variants. */
export type CardVariant = 'flat' | 'elevated' | 'outline';

/** Padding scale. */
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/** Props for `Card`. */
export interface CardProps {
  /** Optional header title rendered above `children`. */
  title?: string;
  /** Optional smaller subtitle below the title. */
  subtitle?: string;
  /** Optional right-aligned content in the header row (e.g. a chip or icon). */
  headerRight?: React.ReactNode;
  /** Visual style; defaults to `'flat'`. */
  variant?: CardVariant;
  /** Inner padding; defaults to `'md'`. */
  padding?: CardPadding;
  /** Make the whole card tappable. When set, the card renders as a `Pressable`. */
  onPress?: () => void;
  /** Required for automation tests. */
  testID?: string;
  /** Screen-reader label when `onPress` is set. */
  accessibilityLabel?: string;
  /** Card body. */
  children: React.ReactNode;
}

/** Container classes per variant. */
function variantClass(variant: CardVariant): string {
  switch (variant) {
    case 'elevated':
      return 'bg-surface-light dark:bg-surface-dark';
    case 'outline':
      return 'border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark';
    case 'flat':
    default:
      return 'bg-muted-light dark:bg-muted-dark';
  }
}

/** Padding classes per padding scale. */
function paddingClass(padding: CardPadding): string {
  switch (padding) {
    case 'none':
      return '';
    case 'sm':
      return 'p-3';
    case 'lg':
      return 'p-6';
    case 'md':
    default:
      return 'p-4';
  }
}

/** Inline shadow style for the `elevated` variant. */
const ELEVATED_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 3,
} as const;

/** Render the card. */
export function Card({
  title,
  subtitle,
  headerRight,
  variant = 'flat',
  padding = 'md',
  onPress,
  testID,
  accessibilityLabel,
  children,
}: CardProps) {
  const className = `rounded-2xl ${variantClass(variant)} ${paddingClass(padding)}`;
  const style = variant === 'elevated' ? ELEVATED_SHADOW : undefined;

  const header =
    title || subtitle || headerRight ? (
      <View className={`flex-row items-start justify-between ${title || subtitle ? 'mb-3' : ''}`}>
        <View className="flex-1 pr-2">
          {title ? (
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {headerRight ? <View>{headerRight}</View> : null}
      </View>
    ) : null;

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={style}
        className={className}
      >
        {header}
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={style} className={className}>
      {header}
      {children}
    </View>
  );
}
