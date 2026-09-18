'use client';

import React, { useState, useEffect } from 'react';
import { loadDeposits, loadOperatorAlerts, requeueSweep, recheckSweep, AdminDeposit, OperatorAlert } from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, Layers, ExternalLink, CheckCircle2, AlertTriangle, Clock3, RotateCcw, RefreshCw } from 'lucide-react';

export default function DepositsPage() {
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [alerts, setAlerts] = useState<OperatorAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainFilter, setChainFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [requeueing, setRequeueing] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState<string | null>(null);

  async function refreshDeposits() {
    const [data, alertData] = await Promise.all([loadDeposits(), loadOperatorAlerts()]);
    setDeposits(data);
    setAlerts(alertData);
    setLoading(false);
  }

  async function handleRequeue(signature: string) {
    setRequeueing(signature);
    const ok = await requeueSweep(signature);
    if (ok) await refreshDeposits();
    setRequeueing(null);
  }

  async function handleRecheck(signature: string) {
    setRechecking(signature);
    const ok = await recheckSweep(signature);
    if (ok) await refreshDeposits();
    setRechecking(null);
  }

  useEffect(() => {
    void refreshDeposits();
  }, []);

  const sweepSummary = deposits.reduce((acc, dep) => {
    const status = dep.sweepStatus || 'UNKNOWN';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const exhausted = deposits.filter((dep) => ['SWEEP_FAILED', 'SWEEP_BLOCKED'].includes(dep.sweepStatus || '') && (dep.sweepAttemptCount || 0) >= 4);

  const filtered = deposits.filter((dep) => {
    if (chainFilter !== 'ALL' && !dep.chain.includes(chainFilter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        dep.txHash.toLowerCase().includes(q) ||
        dep.userName.toLowerCase().includes(q) ||
        dep.token.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Info Banner */}
      <div className="rounded-2xl border border-silver-400/20 bg-muted/40 p-5 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xl font-bold text-foreground">Multi-Chain Custody Listeners</h3>
              <Badge variant="silver" className="font-mono text-[10px]">
                Track A · Privy KMS
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Deposits are polled via EVM RPC & Solana SPL WebSocket listeners in{' '}
              <span className="font-mono text-foreground">apps/worker/chainDepositProcessor.ts</span>. Confirmed deposits
              instantly credit customer balances in the float ledger. Sweep state below shows whether treasury backing is complete or needs operator action.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-xl border border-border/60 bg-card p-3 text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Swept</span>
              <span className="font-mono text-base font-bold text-emerald-400">{sweepSummary.SWEPT || 0}</span>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-3 text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Needs Action</span>
              <span className="font-mono text-base font-bold text-amber-300">{exhausted.length}</span>
            </div>
          </div>
        </div>
      </div>


      {alerts.length > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">Open Operator Alerts</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {alerts.slice(0, 4).map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-border/60 bg-card/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">{alert.title}</span>
                      <Badge variant={alert.severity === 'HIGH' || alert.severity === 'CRITICAL' ? 'warning' : 'silver'} className="text-[10px]">
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{alert.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 max-w-md flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by transaction hash or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => void refreshDeposits()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          {['ALL', 'Monad', 'Solana', 'Polygon'].map((chain) => (
            <button
              key={chain}
              onClick={() => setChainFilter(chain)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                chainFilter === chain
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {chain}
            </button>
          ))}
        </div>
      </div>

      {/* Deposits Table */}
      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No deposit transactions found"
            description="No on-chain deposits matched your query."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/70 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Transaction Hash</th>
                  <th className="px-4 py-3">Chain & Token</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Amount Received</th>
                  <th className="px-4 py-3 text-center">Confirmations</th>
                  <th className="px-4 py-3 text-center">Ledger Credit</th>
                  <th className="px-4 py-3 text-center">Sweep</th>
                  <th className="px-4 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((dep) => (
                  <tr key={dep.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-foreground">
                        <span>{dep.txHash.length > 24 ? `${dep.txHash.slice(0, 16)}...${dep.txHash.slice(-8)}` : dep.txHash}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60 hover:opacity-100 cursor-pointer" />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{dep.chain}</span>
                        <Badge variant={dep.chain.includes('Monad') ? 'silver' : 'outline'} className="text-[10px]">
                          {dep.token}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-foreground">
                      {dep.userName}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400 text-sm">
                      +{dep.amount.toFixed(2)} {dep.token}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        {dep.confirmations} confs
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge variant="success" className="text-[10px]">
                        CREDITED
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge
                          variant={dep.sweepStatus === 'SWEPT' ? 'success' : dep.sweepStatus === 'SWEEP_PROCESSING' ? 'silver' : 'warning'}
                          className="text-[10px]"
                        >
                          {dep.sweepStatus || 'UNKNOWN'}
                        </Badge>
                        {['SWEEP_FAILED', 'SWEEP_BLOCKED'].includes(dep.sweepStatus || '') && (dep.sweepAttemptCount || 0) >= 4 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-300">
                            <AlertTriangle className="h-3 w-3" /> action
                          </span>
                        ) : dep.nextSweepAttemptAt && dep.sweepStatus !== 'SWEPT' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock3 className="h-3 w-3" /> retry {dep.sweepAttemptCount || 0}/4
                          </span>
                        ) : null}
                        {dep.sweepTxHash ? (
                          <span className="max-w-[180px] truncate font-mono text-[10px] text-emerald-300" title={dep.sweepTxHash}>
                            sweep {dep.sweepTxHash.slice(0, 10)}...{dep.sweepTxHash.slice(-6)}
                          </span>
                        ) : null}
                        {dep.sweepError ? (
                          <span className="max-w-[180px] truncate text-[10px] text-muted-foreground" title={dep.sweepError}>
                            {dep.sweepError}
                          </span>
                        ) : null}
                        {dep.sweepStatus !== 'SWEPT' ? (
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {['SWEEP_FAILED', 'SWEEP_BLOCKED'].includes(dep.sweepStatus || '') ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px]"
                                disabled={requeueing === dep.txHash || rechecking === dep.txHash}
                                onClick={() => handleRequeue(dep.txHash)}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                {requeueing === dep.txHash ? 'Retrying' : 'Retry'}
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px]"
                              disabled={requeueing === dep.txHash || rechecking === dep.txHash}
                              onClick={() => handleRecheck(dep.txHash)}
                            >
                              <RefreshCw className="mr-1 h-3 w-3" />
                              {rechecking === dep.txHash ? 'Checking' : 'Recheck'}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-[11px] text-muted-foreground">
                      {dep.createdAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
