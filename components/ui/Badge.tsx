/**
 * Generic pill / badge.
 *
 * Not to be confused with `AccessibilityBadge` — that one is domain-specific
 * (wheelchair icon + 0-10 score). This is the general-purpose chip used for
 * tags, counters, statuses, and category labels.
 */

import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

/** Color variant. Drives bg + text. */
export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent';

/** Size variant. */
export type BadgeSize = 'sm' | 'md' | 'lg';

/** Props for `Badge`. */
export interface BadgeProps {
  /** Label content. */
  children: React.ReactNode;
  /** Color variant; defaults to `'neutral'`. */
  variant?: BadgeVariant;
  /** Size; defaults to `'md'`. */
  size?: BadgeSize;
  /** Optional `Ionicons` glyph rendered before the label. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Render as an outlined pill instead of a solid fill. */
  outlined?: boolean;
  /** Required for automation tests. */
  testID?: string;
}

/** Solid-fill bg + text classes per variant. */
function solidClasses(variant: BadgeVariant): { container: string; text: string; iconColor: string } {
  switch (variant) {
    case 'primary':
      return { container: 'bg-primary', text: 'text-white', iconColor: '#FFFFFF' };
    case 'success':
      return { container: 'bg-success/15', text: 'text-success', iconColor: '#10B981' };
    case 'warning':
      return { container: 'bg-warning/15', text: 'text-warning', iconColor: '#F59E0B' };
    case 'danger':
      return { container: 'bg-danger/15', text: 'text-danger', iconColor: '#EF4444' };
    case 'info':
      return { container: 'bg-info/15', text: 'text-info', iconColor: '#3B82F6' };
    case 'accent':
      return { container: 'bg-accent/15', text: 'text-accent', iconColor: '#F59E0B' };
    case 'neutral':
    default:
      return {
        container: 'bg-muted-light dark:bg-muted-dark',
        text: 'text-gray-700 dark:text-gray-200',
        iconColor: '#6B7280',
      };
  }
}

/** Outlined variant classes (border + matching text). */
function outlinedClasses(variant: BadgeVariant): {
  container: string;
  text: string;
  iconColor: string;
} {
  switch (variant) {
    case 'primary':
      return { container: 'border border-primary', text: 'text-primary', iconColor: '#6366F1' };
    case 'success':
      return { container: 'border border-success', text: 'text-success', iconColor: '#10B981' };
    case 'warning':
      return { container: 'border border-warning', text: 'text-warning', iconColor: '#F59E0B' };
    case 'danger':
      return { container: 'border border-danger', text: 'text-danger', iconColor: '#EF4444' };
    case 'info':
      return { container: 'border border-info', text: 'text-info', iconColor: '#3B82F6' };
    case 'accent':
      return { container: 'border border-accent', text: 'text-accent', iconColor: '#F59E0B' };
    case 'neutral':
    default:
      return {
        container: 'border border-border-light dark:border-border-dark',
        text: 'text-gray-700 dark:text-gray-200',
        iconColor: '#6B7280',
      };
  }
}

/** Per-size container / text / icon sizing. */
function sizing(size: BadgeSize): { container: string; text: string; icon: number; gap: string } {
  switch (size) {
    case 'sm':
      return { container: 'h-5 px-2', text: 'text-[10px]', icon: 10, gap: 'ml-1' };
    case 'lg':
      return { container: 'h-8 px-3', text: 'text-sm', icon: 14, gap: 'ml-1.5' };
    case 'md':
    default:
      return { container: 'h-6 px-2.5', text: 'text-xs', icon: 12, gap: 'ml-1' };
  }
}

/** Render the badge. */
export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  outlined = false,
  testID,
}: BadgeProps) {
  const palette = outlined ? outlinedClasses(variant) : solidClasses(variant);
  const { container, text, icon: iconSize, gap } = sizing(size);

  return (
    <View
      testID={testID}
      className={`flex-row items-center rounded-full ${container} ${palette.container}`}
    >
      {icon ? <Ionicons name={icon} size={iconSize} color={palette.iconColor} /> : null}
      <Text className={`font-semibold ${text} ${palette.text} ${icon ? gap : ''}`}>
        {children}
      </Text>
    </View>
  );
}
