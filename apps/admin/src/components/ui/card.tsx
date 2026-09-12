import * as React from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
}

export function Card({ className, title, subtitle, headerAction, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card/90 p-5 shadow-xs backdrop-blur-md transition-all',
        className
      )}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-border/40">
          <div>
            {title && <h3 className="font-display text-xl font-bold tracking-tight text-foreground">{title}</h3>}
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
