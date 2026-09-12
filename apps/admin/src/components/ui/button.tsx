import * as React from 'react';
import { cn } from '@/lib/cn';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props }, ref) => {
    const variantStyles = {
      primary:
        'bg-foreground text-background hover:opacity-90 active:scale-[0.98] shadow-xs font-semibold',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-muted active:scale-[0.98] border border-border/80',
      outline:
        'border border-border/80 bg-card/60 hover:bg-muted text-foreground active:scale-[0.98]',
      destructive:
        'bg-destructive/15 text-destructive border border-destructive/20 hover:bg-destructive/25 active:scale-[0.98]',
      ghost:
        'text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.98]',
    }[variant];

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
      md: 'h-9 px-4 text-xs font-medium rounded-xl gap-2',
      lg: 'h-11 px-6 text-sm font-medium rounded-xl gap-2.5',
      icon: 'h-9 w-9 p-0 rounded-xl justify-center',
    }[size];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          variantStyles,
          sizeStyles,
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
