export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  bgCard: string;
  borderCard: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentSecondary: string;
  accentMetallic: string;
  accentGlow: string;
  success: string;
  warning: string;
  error: string;
  shadow: string;
}

export const lightTheme: ThemeColors = {
  bg: '#FFFFFF',
  bgSecondary: '#F8FAFC',
  bgCard: 'rgba(255, 255, 255, 0.88)',
  borderCard: 'rgba(15, 23, 42, 0.12)',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  accentPrimary: '#1E293B',
  accentSecondary: '#475569',
  accentMetallic: '#94A3B8',
  accentGlow: 'rgba(148, 163, 184, 0.25)',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  shadow: '0 8px 30px rgba(15, 23, 42, 0.08)'
};

export const darkTheme: ThemeColors = {
  bg: '#090A0F',
  bgSecondary: '#11131A',
  bgCard: 'rgba(255, 255, 255, 0.04)',
  borderCard: 'rgba(255, 255, 255, 0.12)',
  textPrimary: '#FFFFFF',
  textSecondary: '#E2E8F0',
  textMuted: '#94A3B8',
  accentPrimary: '#F8FAFC',
  accentSecondary: '#E2E8F0',
  accentMetallic: '#CBD5E1',
  accentGlow: 'rgba(226, 232, 240, 0.18)',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)'
};

export const typography = {
  fontDisplay: "'Smooch Sans', sans-serif",
  fontMono: "'Share Tech Mono', monospace",
  fontSans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
};

export const fontGoogleImports = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Smooch+Sans:wght@300;400;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap');
`;
