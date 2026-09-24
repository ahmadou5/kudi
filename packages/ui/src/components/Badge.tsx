import * as React from 'react';
import { ThemeMode, lightTheme, darkTheme, typography } from '../theme';

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'destructive' | 'secondary' | 'outline' | 'silver' | 'mono';
  mode?: ThemeMode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  mode = 'dark',
  children,
  style
}) => {
  const colors = mode === 'light' ? lightTheme : darkTheme;

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'success':
        return {
          background: 'rgba(16, 185, 129, 0.15)',
          color: colors.success,
          border: '1px solid rgba(16, 185, 129, 0.3)'
        };
      case 'warning':
        return {
          background: 'rgba(245, 158, 11, 0.15)',
          color: colors.warning,
          border: '1px solid rgba(245, 158, 11, 0.3)'
        };
      case 'error':
      case 'destructive':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          color: colors.error,
          border: '1px solid rgba(239, 68, 68, 0.3)'
        };
      case 'secondary':
        return {
          background: 'rgba(148, 163, 184, 0.15)',
          color: '#94A3B8',
          border: '1px solid rgba(148, 163, 184, 0.3)'
        };
      case 'outline':
        return {
          background: 'transparent',
          color: colors.textPrimary,
          border: `1px solid ${colors.borderCard}`
        };
      case 'silver':
        return {
          background: mode === 'light' ? 'rgba(100, 116, 139, 0.12)' : 'rgba(226, 232, 240, 0.15)',
          color: mode === 'light' ? '#334155' : '#E2E8F0',
          border: `1px solid ${colors.accentMetallic}`
        };
      case 'mono':
        return {
          background: mode === 'light' ? '#0F172A' : '#F8FAFC',
          color: mode === 'light' ? '#FFFFFF' : '#0F172A',
          border: 'none',
          fontFamily: typography.fontMono
        };
      case 'default':
      default:
        return {
          background: mode === 'light' ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.08)',
          color: colors.textSecondary,
          border: `1px solid ${colors.borderCard}`
        };
    }
  };

  return React.createElement(
    'span',
    {
      style: {
        fontFamily: variant === 'mono' ? typography.fontMono : typography.fontSans,
        fontSize: '12px',
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: '20px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        lineHeight: 1,
        ...getVariantStyles(),
        ...style
      }
    },
    children
  );
};
