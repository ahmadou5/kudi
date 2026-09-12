import * as React from 'react';
import { cn } from '@/lib/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'silver';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantStyles = {
    default: 'border-transparent bg-primary text-primary-foreground shadow-xs',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    destructive: 'border-transparent bg-destructive/15 text-destructive border border-destructive/20',
    outline: 'text-foreground border border-border',
    success: 'border-transparent bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    warning: 'border-transparent bg-amber-500/15 text-amber-400 border border-amber-500/20',
    silver: 'border-border bg-silver-500/10 text-silver-300 border border-silver-400/20',
  }[variant];

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none',
        variantStyles,
        className
      )}
      {...props}
    />
  );
}
