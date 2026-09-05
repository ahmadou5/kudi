import * as React from 'react';
import { ThemeMode, lightTheme, darkTheme, typography } from '../theme';

export interface ThemeToggleProps {
  mode: ThemeMode;
  onToggle: (newMode: ThemeMode) => void;
  style?: React.CSSProperties;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ mode, onToggle, style }) => {
  const colors = mode === 'light' ? lightTheme : darkTheme;

  return React.createElement(
    'button',
    {
      onClick: () => onToggle(mode === 'light' ? 'dark' : 'light'),
      ariaLabel: `Switch to ${mode === 'light' ? 'dark' : 'light'} mode`,
      style: {
        fontFamily: typography.fontSans,
        fontSize: '13px',
        fontWeight: 600,
        padding: '8px 16px',
        borderRadius: '30px',
        background: mode === 'light' ? '#0F172A' : 'rgba(255, 255, 255, 0.1)',
        color: mode === 'light' ? '#FFFFFF' : '#E2E8F0',
        border: `1px solid ${colors.borderCard}`,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.25s ease',
        ...style
      }
    },
    mode === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'
  );
};
