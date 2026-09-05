import { Platform } from 'react-native';

/**
 * Brand Font Families:
 * 1. Smooch Sans: Brand Display & Main Headings
 * 2. Share Tech Mono: Financial Values, USDC/NGN Amounts, Monospace Codes
 * 3. Inter: Body Text, Labels, and UI Components
 */
export const FONT_FAMILY = {
  display: Platform.select({
    web: 'SpaceMono_400Regular, "Space Mono", monospace',
    ios: 'SpaceMono_400Regular',
    android: 'SpaceMono_400Regular',
    default: 'SpaceMono_400Regular'
  }),
  mono: Platform.select({
    web: 'SpaceMono_400Regular, "Space Mono", monospace',
    ios: 'SpaceMono_400Regular',
    android: 'SpaceMono_400Regular',
    default: 'SpaceMono_400Regular'
  }),
  sans: Platform.select({
    web: 'Nunito_700Bold, "Nunito", sans-serif',
    ios: 'Nunito_700Bold',
    android: 'Nunito_700Bold',
    default: 'Nunito_700Bold'
  })
};

/**
 * Percel-compatible Typography tokens + Metropolis Apple Design presets
 */
export const Typography = {
  // Percel typography scale & weights
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  family: {
    regular: FONT_FAMILY.sans,
    medium: FONT_FAMILY.sans,
    semibold: FONT_FAMILY.sans,
    bold: FONT_FAMILY.sans,
    display: FONT_FAMILY.display,
    mono: FONT_FAMILY.mono,
    sans: FONT_FAMILY.sans,
  },

  // Metropolis design system presets
  displayLarge: {
    fontFamily: FONT_FAMILY.display,
    fontSize: 48,
    lineHeight: 52,
  },
  display: {
    fontFamily: FONT_FAMILY.display,
    fontSize: 36,
    lineHeight: 40,
  },
  title1: {
    fontFamily: FONT_FAMILY.display,
    fontSize: 28,
    lineHeight: 32,
  },
  title2: {
    fontFamily: FONT_FAMILY.display,
    fontSize: 22,
    lineHeight: 26,
  },
  title3: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: 16,
    lineHeight: 22,
  },
  bodyBold: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  body: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  subhead: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  footnote: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  caption: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    lineHeight: 14,
  },
  currencyDisplay: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 32,
    fontVariant: ['tabular-nums' as const],
  },
  currencySub: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 15,
    fontVariant: ['tabular-nums' as const],
  }
};

