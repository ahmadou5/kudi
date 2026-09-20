'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[AdminDashboard] Render error:', error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <Card className="max-w-lg border border-red-500/30 bg-red-500/5 p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-500/30 bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-300" />
          </div>
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Dashboard could not render</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                One live admin API value was missing or malformed. The page is protected now; retry after the API refreshes.
              </p>
            </div>
            <p className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {error.message}
            </p>
            <Button size="sm" onClick={reset} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry dashboard
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
