import * as React from 'react';
import { cn } from '@/lib/cn';
import { Layers } from 'lucide-react';

export function EmptyState({
  icon: Icon = Layers,
  title,
  description,
  action,
  className
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center bg-card/30', className)}>
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-border/80 bg-muted/60 text-muted-foreground mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h4 className="font-display text-lg font-bold text-foreground">{title}</h4>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
