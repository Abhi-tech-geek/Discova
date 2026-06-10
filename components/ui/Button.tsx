/**
 * Reusable Button.
 * NativeWind-only styling, dark mode aware, optional left/right icon,
 * loading + disabled states, three sizes and five visual variants.
 *
 * Drop-in replacement anywhere we'd otherwise repeat the same Pressable +
 * ActivityIndicator + icon pattern across screens.
 */

import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';

/** Visual variants. `ghost` = transparent bg, just text + icon. */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

/** Size variants — drives height, font size, and icon size. */
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Props for `Button`. */
export interface ButtonProps {
  /** Press handler. Ignored while loading or disabled. */
  onPress?: () => void;
  /** Visual variant; defaults to `'primary'`. */
  variant?: ButtonVariant;
  /** Height + text size; defaults to `'md'`. */
  size?: ButtonSize;
  /** Show inline spinner; disables press. */
  loading?: boolean;
  /** Greyed out + non-interactive. */
  disabled?: boolean;
  /** Optional `Ionicons` name to render beside the label. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Where to place the icon relative to the label. Defaults `'left'`. */
  iconPosition?: 'left' | 'right';
  /** Take the full container width. */
  fullWidth?: boolean;
  /** Button label / content. */
  children: React.ReactNode;
  /** Required for automation tests. */
  testID?: string;
  /** Screen-reader label. Falls back to `children` text if it's a string. */
  accessibilityLabel?: string;
  /** Pass-through `accessibilityHint` if you want to add context. */
  accessibilityHint?: PressableProps['accessibilityHint'];
}

/** Container classes per variant. */
function containerClass(variant: ButtonVariant, disabled: boolean): string {
  const dimmed = disabled ? 'opacity-50' : '';
  switch (variant) {
    case 'primary':
      return `bg-primary ${dimmed}`;
    case 'secondary':
      return `bg-muted-light dark:bg-muted-dark ${dimmed}`;
    case 'outline':
      return `border border-primary bg-surface-light dark:bg-surface-dark ${dimmed}`;
    case 'danger':
      return `bg-danger ${dimmed}`;
    case 'ghost':
      return dimmed;
  }
}

/** Text classes per variant. */
function textClass(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':
    case 'danger':
      return 'text-white';
    case 'secondary':
      return 'text-gray-900 dark:text-white';
    case 'outline':
    case 'ghost':
      return 'text-primary';
  }
}

/** Icon color per variant. */
function iconColor(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':
    case 'danger':
      return '#FFFFFF';
    case 'secondary':
      return '#1F2937';
    case 'outline':
    case 'ghost':
      return '#6366F1';
  }
}

/** Per-size container / text / icon sizing. */
function sizing(size: ButtonSize): {
  container: string;
  text: string;
  icon: number;
  gap: string;
} {
  switch (size) {
    case 'sm':
      return { container: 'h-9 px-3 rounded-xl', text: 'text-xs', icon: 14, gap: 'ml-1.5' };
    case 'lg':
      return { container: 'h-14 px-5 rounded-2xl', text: 'text-base', icon: 20, gap: 'ml-2.5' };
    case 'md':
    default:
      return { container: 'h-12 px-4 rounded-2xl', text: 'text-sm', icon: 18, gap: 'ml-2' };
  }
}

/** Render the button. */
export function Button({
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  children,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const blocked = loading || disabled;
  const { container, text, icon: iconSize, gap } = sizing(size);
  const widthClass = fullWidth ? 'w-full' : '';
  const baseClass = `flex-row items-center justify-center ${container} ${containerClass(variant, blocked)} ${widthClass}`;
  const labelClass = `font-semibold ${text} ${textClass(variant)}`;
  const color = iconColor(variant);

  /** Stable string label for the screen reader. */
  const a11yLabel =
    accessibilityLabel ?? (typeof children === 'string' ? children : undefined);

  const renderIcon = (position: 'left' | 'right') => {
    if (!icon || iconPosition !== position) return null;
    return (
      <Ionicons
        name={icon}
        size={iconSize}
        color={color}
        style={position === 'right' ? { marginLeft: 8 } : undefined}
      />
    );
  };

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      className={baseClass}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <View className="flex-row items-center">
          {renderIcon('left')}
          {typeof children === 'string' ? (
            <Text className={`${labelClass} ${icon && iconPosition === 'left' ? gap : ''}`}>
              {children}
            </Text>
          ) : (
            children
          )}
          {renderIcon('right')}
        </View>
      )}
    </Pressable>
  );
}
