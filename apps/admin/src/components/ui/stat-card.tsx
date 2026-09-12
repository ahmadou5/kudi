import * as React from 'react';
import { cn } from '@/lib/cn';
import { Card } from './card';
import { TrendingUp, ArrowUpRight, DollarSign, Wallet, Users, RefreshCw, ShieldCheck } from 'lucide-react';

export function StatCard({
  label,
  value,
  delta,
  tone = 'primary',
  description
}: {
  label: string;
  value: string;
  delta: string;
  tone?: 'primary' | 'success' | 'warning' | 'muted';
  description?: string;
}) {
  const toneStyles = {
    primary: 'text-foreground bg-foreground/10 border-foreground/20',
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    muted: 'text-muted-foreground bg-muted border-border',
  }[tone];

  const Icon = label.toLowerCase().includes('volume') || label.toLowerCase().includes('spend')
    ? DollarSign
    : label.toLowerCase().includes('wallet') || label.toLowerCase().includes('custody')
    ? Wallet
    : label.toLowerCase().includes('user') || label.toLowerCase().includes('customer')
    ? Users
    : label.toLowerCase().includes('rate') || label.toLowerCase().includes('p2p')
    ? RefreshCw
    : ShieldCheck;

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow-sm hover:border-silver-400/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('grid h-10 w-10 place-items-center rounded-xl border transition-transform group-hover:scale-105 shadow-xs', toneStyles)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
          </div>
        </div>
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-bold shadow-xs', toneStyles)}>
          <TrendingUp className="h-3 w-3" />
          {delta}
        </span>
      </div>
      {description && (
        <p className="mt-3 text-xs text-muted-foreground border-t border-border/40 pt-2.5 flex items-center justify-between">
          <span>{description}</span>
          <ArrowUpRight className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
        </p>
      )}
    </Card>
  );
}
