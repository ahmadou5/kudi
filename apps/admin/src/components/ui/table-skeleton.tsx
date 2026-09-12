import * as React from 'react';
import { Card } from './card';

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="h-5 w-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
                </div>
              </div>
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
