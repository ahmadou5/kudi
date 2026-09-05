import * as React from 'react';
import { ThemeMode, lightTheme, darkTheme, typography } from '../theme';

export interface HeadingProps {
  level?: 1 | 2 | 3 | 4;
  mode?: ThemeMode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const Heading: React.FC<HeadingProps> = ({
  level = 1,
  mode = 'dark',
  children,
  style,
  className
}) => {
  const colors = mode === 'light' ? lightTheme : darkTheme;

  const fontSizes: Record<1 | 2 | 3 | 4, string> = {
    1: 'clamp(36px, 5vw, 60px)',
    2: 'clamp(28px, 4vw, 42px)',
    3: 'clamp(22px, 3vw, 32px)',
    4: '20px'
  };

  const tag = `h${level}`;

  return React.createElement(
    tag,
    {
      className,
      style: {
        fontFamily: typography.fontDisplay,
        fontSize: fontSizes[level],
        fontWeight: 800,
        letterSpacing: '-0.5px',
        lineHeight: 1.1,
        color: colors.textPrimary,
        margin: 0,
        ...style
      }
    },
    children
  );
};

export interface MonoProps {
  mode?: ThemeMode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Mono: React.FC<MonoProps> = ({
  mode = 'dark',
  children,
  style,
  className,
  size = 'md'
}) => {
  const colors = mode === 'light' ? lightTheme : darkTheme;

  const sizeMap = {
    sm: '12px',
    md: '14px',
    lg: '18px',
    xl: '28px'
  };

  return React.createElement(
    'span',
    {
      className,
      style: {
        fontFamily: typography.fontMono,
        fontSize: sizeMap[size],
        color: colors.textPrimary,
        letterSpacing: '0.2px',
        ...style
      }
    },
    children
  );
};
