import * as React from 'react';
import { ThemeMode, lightTheme, darkTheme, typography } from '../theme';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  mode?: ThemeMode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  mode = 'dark',
  children,
  style,
  disabled,
  ...props
}) => {
  const colors = mode === 'light' ? lightTheme : darkTheme;

  const sizeStyles: Record<'sm' | 'md' | 'lg', React.CSSProperties> = {
    sm: { padding: '6px 14px', fontSize: '13px', borderRadius: '10px' },
    md: { padding: '10px 20px', fontSize: '14px', borderRadius: '14px' },
    lg: { padding: '14px 28px', fontSize: '16px', borderRadius: '16px' }
  };

  const getVariantStyles = (): React.CSSProperties => {
    if (disabled) {
      return {
        background: mode === 'light' ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
        color: mode === 'light' ? '#94A3B8' : '#64748B',
        border: '1px solid transparent',
        cursor: 'not-allowed'
      };
    }

    switch (variant) {
      case 'primary':
        return {
          background: mode === 'light' ? 'linear-gradient(135deg, #0F172A 0%, #334155 100%)' : 'linear-gradient(135deg, #F8FAFC 0%, #CBD5E1 100%)',
          color: mode === 'light' ? '#FFFFFF' : '#0F172A',
          border: 'none',
          boxShadow: mode === 'light' ? '0 4px 14px rgba(15, 23, 42, 0.25)' : '0 4px 20px rgba(226, 232, 240, 0.2)',
          fontWeight: 700
        };
      case 'secondary':
        return {
          background: mode === 'light' ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.08)',
          color: colors.textPrimary,
          border: `1px solid ${colors.borderCard}`,
          fontWeight: 600
        };
      case 'outline':
        return {
          background: 'transparent',
          color: colors.textPrimary,
          border: `1px solid ${colors.accentMetallic}`,
          fontWeight: 600
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: colors.textSecondary,
          border: 'none',
          fontWeight: 500
        };
    }
  };

  return React.createElement(
    'button',
    {
      disabled,
      style: {
        fontFamily: typography.fontSans,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        outline: 'none',
        ...sizeStyles[size],
        ...getVariantStyles(),
        ...style
      },
      ...props
    },
    children
  );
};
