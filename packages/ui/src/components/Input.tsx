import * as React from 'react';
import { ThemeMode, lightTheme, darkTheme, typography } from '../theme';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  mode?: ThemeMode;
  mono?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  mode = 'dark',
  mono = false,
  style,
  id,
  ...props
}) => {
  const colors = mode === 'light' ? lightTheme : darkTheme;
  const inputId = id || `kudi_input_${Math.random().toString(36).substring(2, 9)}`;

  return React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' } },
    label
      ? React.createElement(
          'label',
          {
            htmlFor: inputId,
            style: {
              fontFamily: typography.fontSans,
              fontSize: '13px',
              fontWeight: 600,
              color: colors.textSecondary
            }
          },
          label
        )
      : null,
    React.createElement('input', {
      id: inputId,
      style: {
        fontFamily: mono ? typography.fontMono : typography.fontSans,
        fontSize: '14px',
        padding: '12px 16px',
        borderRadius: '12px',
        background: mode === 'light' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
        color: colors.textPrimary,
        border: `1px solid ${error ? colors.error : colors.borderCard}`,
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        ...style
      },
      ...props
    }),
    error || helperText
      ? React.createElement(
          'span',
          {
            style: {
              fontFamily: typography.fontSans,
              fontSize: '12px',
              color: error ? colors.error : colors.textMuted
            }
          },
          error || helperText
        )
      : null
  );
};
