import * as React from 'react';
import { ThemeMode, lightTheme, darkTheme, typography } from '../theme';

export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  mode?: ThemeMode;
  className?: string;
  style?: React.CSSProperties;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  mode = 'dark',
  className,
  style,
  action
}) => {
  const colors = mode === 'light' ? lightTheme : darkTheme;

  return React.createElement(
    'div',
    {
      className,
      style: {
        background: colors.bgCard,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${colors.borderCard}`,
        borderRadius: '20px',
        padding: '24px',
        color: colors.textPrimary,
        boxShadow: colors.shadow,
        transition: 'all 0.3s ease',
        ...style
      }
    },
    title || action
      ? React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: subtitle ? '4px' : '16px'
            }
          },
          title
            ? typeof title === 'string'
              ? React.createElement(
                  'h3',
                  {
                    style: {
                      margin: 0,
                      fontFamily: typography.fontDisplay,
                      fontSize: '24px',
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      color: colors.textPrimary
                    }
                  },
                  title
                )
              : title
            : React.createElement('div'),
          action
        )
      : null,
    subtitle
      ? typeof subtitle === 'string'
        ? React.createElement(
            'p',
            {
              style: {
                margin: '0 0 16px 0',
                fontFamily: typography.fontSans,
                fontSize: '13px',
                color: colors.textMuted
              }
            },
            subtitle
          )
        : subtitle
      : null,
    children
  );
};
