/**
 * DISCOVA design system tokens (JS side — for inline styles where Tailwind
 * can't reach, like LinearGradient `colors`, react-native-maps tint, etc.).
 */

export const AURORA = ['#13C2E8', '#2E6BFF', '#7A3DF5'] as const;
export const AURORA_SOFT = ['rgba(19,194,232,0.14)', 'rgba(46,107,255,0.12)', 'rgba(122,61,245,0.14)'] as const;

export const COLORS = {
  bg: '#F4F6F9',
  bg2: '#ECEFF4',
  surface: '#FFFFFF',
  surface2: '#F7F9FC',
  hairline: '#E6EAF0',
  hairline2: '#D9DEE7',
  ink: '#13161C',
  ink2: '#5A6273',
  ink3: '#98A0B0',
  brand: '#2E6BFF',
  like: '#FF3B5C',
  coin: '#F6A82B',
  verify: '#2E6BFF',
  aHigh: '#11A861',
  aMid: '#E0A100',
  aLow: '#E5484D',
  aHighBg: '#E4F6EC',
  aMidBg: '#FBF1D8',
  aLowBg: '#FCE7E7',
} as const;

/** Dark-mode counterparts to the light surface/ink tokens. */
export const DARK = {
  bg: '#0B0C10',
  bg2: '#101218',
  surface: '#15171C',
  surface2: '#1E2128',
  hairline: '#262A33',
  hairline2: '#2F3540',
  ink: '#F3F5F8',
  ink2: '#A8B0BE',
  ink3: '#6B7280',
} as const;

/**
 * Theme-aware palette. Returns the full `COLORS` token set, with the
 * surface/ink tokens swapped for their dark equivalents when `isDark`.
 * Accent tokens (brand, like, coin, aHigh, …) stay the same in both modes.
 * Use in inline-styled components: `const C = surfaces(isDark);` then `C.surface`.
 */
export function surfaces(isDark: boolean): Record<keyof typeof COLORS, string> {
  if (!isDark) return COLORS;
  return {
    ...COLORS,
    bg: DARK.bg,
    bg2: DARK.bg2,
    surface: DARK.surface,
    surface2: DARK.surface2,
    hairline: DARK.hairline,
    hairline2: DARK.hairline2,
    ink: DARK.ink,
    ink2: DARK.ink2,
    ink3: DARK.ink3,
  };
}

/** Accessibility tier for a 0-100 score. */
export interface Tier {
  label: 'A+' | 'A' | 'B' | 'C';
  color: string;
  bg: string;
  word: string;
}

/** Map a 0-100 accessibility score to its tier metadata. */
export function tierFor(score: number): Tier {
  if (score >= 85) {
    return {
      label: score >= 92 ? 'A+' : 'A',
      color: COLORS.aHigh,
      bg: COLORS.aHighBg,
      word: 'Fully accessible',
    };
  }
  if (score >= 68) {
    return { label: 'B', color: COLORS.aMid, bg: COLORS.aMidBg, word: 'Partly accessible' };
  }
  return { label: 'C', color: COLORS.aLow, bg: COLORS.aLowBg, word: 'Limited access' };
}

/** 7-stop palette for `GradientAvatar`'s initial-monogram backgrounds. */
export const AVATAR_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#FF7E9D', '#7A3DF5'],
  ['#13C2E8', '#2E6BFF'],
  ['#11A861', '#13C2E8'],
  ['#F6A82B', '#FF7E9D'],
  ['#7A3DF5', '#13C2E8'],
  ['#FF6B57', '#F0397E'],
  ['#2E6BFF', '#11A861'],
];

/** Stable 3-stop mesh-gradient palette per place category. */
export const MESH_PALETTES: Record<string, readonly [string, string, string]> = {
  cafe: ['#F0DCC2', '#CC9A63', '#6E4A2C'],
  restaurant: ['#F4C9A6', '#E07A5F', '#7A2E2E'],
  mall: ['#D2E1FF', '#8FA9E8', '#39477F'],
  park: ['#C4ECCB', '#4FB477', '#1E5E3A'],
  monument: ['#FFE6A6', '#F2A65A', '#4F95D6'],
  tourist: ['#FFE6A6', '#F2A65A', '#4F95D6'],
  rooftop: ['#FFC4A0', '#FF7E9D', '#5C4A93'],
  museum: ['#E7E3DB', '#B6AC9B', '#544E40'],
  hidden: ['#BFF0E9', '#46C2B4', '#1C6A63'],
  beach: ['#BDE9F2', '#5FC0D6', '#1F6E8C'],
  airport: ['#D2E1FF', '#8FA9E8', '#39477F'],
  shopping: ['#FFC4A0', '#FF7E9D', '#5C4A93'],
  neighborhood: ['#E7E3DB', '#B6AC9B', '#544E40'],
  general: ['#D2E1FF', '#8FA9E8', '#39477F'],
};

/** Resolve a palette by free-text category (case-insensitive, fallback to general). */
export function paletteFor(category: string): readonly [string, string, string] {
  const k = category.toLowerCase();
  return MESH_PALETTES[k] ?? MESH_PALETTES.general;
}
