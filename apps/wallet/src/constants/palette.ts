export type AccentId = 'slate' | 'violet' | 'indigo' | 'emerald' | 'sky' | 'rose';
export type SurfaceId = 'neutral' | 'muted' | 'deep';
export type CardTintId = 'flat' | 'soft' | 'elevated';

export interface AccentOption {
  id: AccentId;
  label: string;
  /** Accent used on the dark scheme (kept light so dark ink stays readable). */
  dark: string;
  /** Accent used on the light scheme (kept deep so white ink stays readable). */
  light: string;
}

export const ACCENTS: AccentOption[] = [
  { id: 'slate', label: 'Slate', dark: '#CBD5E1', light: '#0F172A' },
  { id: 'violet', label: 'Violet', dark: '#A78BFA', light: '#6D28D9' },
  { id: 'indigo', label: 'Indigo', dark: '#818CF8', light: '#4338CA' },
  { id: 'emerald', label: 'Emerald', dark: '#34D399', light: '#047857' },
  { id: 'sky', label: 'Sky', dark: '#38BDF8', light: '#0369A1' },
  { id: 'rose', label: 'Rose', dark: '#FB7185', light: '#BE123C' }
];

export type CardAccentId = 'ngn' | 'usd' | 'eur' | 'usdc';

export const CARD_HUE_TARGETS: Record<CardAccentId, string> = {
  ngn: '#22C55E',
  usd: '#3B82F6',
  eur: '#8B5CF6',
  usdc: '#14B8A6'
};

export interface SurfaceOption {
  id: SurfaceId;
  dark: { label: string; bg: string };
  light: { label: string; bg: string };
}

export const SURFACES: SurfaceOption[] = [
  { id: 'neutral', dark: { label: 'Midnight', bg: '#090A0F' }, light: { label: 'White', bg: '#FFFFFF' } },
  { id: 'muted', dark: { label: 'Charcoal', bg: '#111318' }, light: { label: 'Mist', bg: '#F8FAFC' } },
  { id: 'deep', dark: { label: 'Graphite', bg: '#191C24' }, light: { label: 'Stone', bg: '#F1EFEA' } }
];

export interface CardTintOption {
  id: CardTintId;
  label: string;
  /** Blend factor of the card surface away from the page background. */
  dark: number;
  light: number;
}

export const CARD_TINTS: CardTintOption[] = [
  { id: 'flat', label: 'Flat', dark: 0.04, light: 0.03 },
  { id: 'soft', label: 'Soft', dark: 0.06, light: 0.05 },
  { id: 'elevated', label: 'Elevated', dark: 0.09, light: 0.08 }
];

export const Colors = {
  dark: {
    scheme: 'dark',
    primary: '#CBD5E1',
    primaryDark: '#94A3B8',
    accent: '#CBD5E1',
    success: '#34D399',
    error: '#F87171',
    warning: '#FBBF24',
    bg: '#090A0F',
    card: '#13151E',
    text: '#FFFFFF',
    textSecondary: '#E2E8F0',
    border: 'rgba(255, 255, 255, 0.12)'
  },
  light: {
    scheme: 'light',
    primary: '#0F172A',
    primaryDark: '#1E293B',
    accent: '#0F172A',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    bg: '#FFFFFF',
    card: '#F8FAFC',
    text: '#0F172A',
    textSecondary: '#475569',
    border: '#E2E8F0'
  }
};
