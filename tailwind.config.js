/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── DISCOVA design tokens (aurora) ───────────────────────────
        bg: '#F4F6F9',
        'bg-2': '#ECEFF4',
        hairline: '#E6EAF0',
        'hairline-2': '#D9DEE7',
        ink: '#13161C',
        'ink-2': '#5A6273',
        'ink-3': '#98A0B0',
        // brand aurora stops
        'brand-1': '#13C2E8',
        'brand-2': '#2E6BFF',
        'brand-3': '#7A3DF5',
        like: '#FF3B5C',
        coin: '#F6A82B',
        verify: '#2E6BFF',
        // accessibility tier colors + bg tints
        'a-high': '#11A861',
        'a-mid': '#E0A100',
        'a-low': '#E5484D',
        'a-high-bg': '#E4F6EC',
        'a-mid-bg': '#FBF1D8',
        'a-low-bg': '#FCE7E7',

        // ── Legacy keys (existing screens) — remapped to aurora ──────
        primary: {
          DEFAULT: '#2E6BFF',
          50: '#EAF1FF',
          100: '#D6E4FF',
          200: '#ADC8FF',
          300: '#7FA6FF',
          400: '#5588FF',
          500: '#2E6BFF',
          600: '#1F58E0',
          700: '#1A47B8',
          800: '#163A95',
          900: '#0E2A6F',
        },
        accent: {
          DEFAULT: '#F6A82B',
          light: '#FCE0AC',
          dark: '#9A6B12',
        },
        success: '#11A861',
        warning: '#E0A100',
        danger: '#E5484D',
        info: '#2E6BFF',
        surface: {
          light: '#FFFFFF',
          dark: '#0E1118',
          DEFAULT: '#FFFFFF',
          2: '#F7F9FC',
        },
        muted: {
          light: '#F4F6F9',
          dark: '#1A1E27',
        },
        border: {
          light: '#E6EAF0',
          dark: '#262B36',
        },
      },
      borderRadius: {
        card: '22px',
        button: '16px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 6px 20px rgba(20,22,28,0.06)',
        pop: '0 10px 30px rgba(20,22,28,0.14)',
        brand: '0 10px 30px rgba(46,107,255,0.4)',
      },
      fontFamily: {
        sans: ['System'],
        display: ['System'],
        mono: ['Menlo', 'Courier'],
      },
      letterSpacing: {
        tight2: '-0.02em',
        tight3: '-0.03em',
        wide2: '0.14em',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
    },
  },
  plugins: [],
};
