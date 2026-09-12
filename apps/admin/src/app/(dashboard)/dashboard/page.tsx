'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  loadDashboardSnapshot,
  AdminDashboardSnapshot,
  AdminSpendTransaction,
  AdminDeposit,
} from '@/lib/admin-data';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VolumeAreaChart } from '@/components/ui/charts';
import {
  ArrowRight,
  RefreshCw,
  Download,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sliders,
  TrendingUp,
} from 'lucide-react';

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [rateInput, setRateInput] = useState('1585.50');
  const [activeProvider, setActiveProvider] = useState('PAYSTACK');
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardSnapshot().then((data) => {
      setSnapshot(data);
      if (data.rateState?.currentRateNGN) {
        setRateInput(data.rateState.currentRateNGN.toFixed(2));
      }
      const activeRail = data.payoutRails.find((r) => r.active);
      if (activeRail) {
        setActiveProvider(activeRail.id);
      }
      setLoading(false);
    });
  }, []);

  const handleRateOverride = async () => {
    const val = parseFloat(rateInput);
    if (!val || val <= 0) return;
    try {
      await fetch('/api/admin/rate-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRateNGN: val }),
      });
      setOverrideMsg(`Rate overridden to ₦${val.toFixed(2)} / USDC`);
      setTimeout(() => setOverrideMsg(null), 4000);
    } catch {
      setOverrideMsg(`Rate override applied in-memory: ₦${val.toFixed(2)}`);
      setTimeout(() => setOverrideMsg(null), 4000);
    }
  };

  const handleProviderSwitch = async (provId: string) => {
    try {
      await fetch('/api/admin/set-active-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: provId }),
      });
      setActiveProvider(provId);
    } catch {
      setActiveProvider(provId);
    }
  };

  if (loading || !snapshot) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-card/60 animate-pulse border border-border/80" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-card/60 animate-pulse border border-border/80" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Top KPI Cards Row ─── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {snapshot.kpis.map((kpi, i) => (
          <StatCard
            key={i}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            tone={kpi.tone}
            description={kpi.description}
          />
        ))}
      </section>

      {/* ─── Main Grid: Volume Chart & Quick Rate Control ─── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 7-Day Volume Trend Chart */}
        <Card
          className="lg:col-span-2"
          title="Daily Processed Volume (USDC → NGN)"
          subtitle="7-day moving settlement across Monad Metropolis & Solana deposit rails"
          headerAction={
            <Badge variant="silver" className="font-mono">
              Last 7 Days
            </Badge>
          }
        >
          <VolumeAreaChart data={snapshot.volumeChart} />
        </Card>

        {/* Live Exchange Rate Override Card */}
        <Card
          title="Rate Engine & FX Oracle"
          subtitle="Binance & Bybit P2P weighted blend with configurable spread"
          headerAction={
            <Badge variant="warning" className="font-mono text-[10px]">
              SPREAD: 0.9%
            </Badge>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Active Exchange Rate
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-mono text-3xl font-bold text-emerald-400">₦{rateInput}</span>
                <span className="text-xs font-mono text-muted-foreground">/ USDC</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Market baseline: ₦{snapshot.rateState.blendedMarketRate.toFixed(2)} (Bybit: ₦{snapshot.rateState.bybitP2PRate} · Binance: ₦{snapshot.rateState.binanceP2PRate})
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Manual Override (NGN / USDC)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  mono
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="h-9"
                />
                <Button size="sm" onClick={handleRateOverride} className="shrink-0 font-semibold">
                  Override
                </Button>
              </div>
              {overrideMsg && (
                <p className="text-xs text-emerald-400 font-medium animate-fade-in flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {overrideMsg}
                </p>
              )}
            </div>

            <div className="border-t border-border/40 pt-3">
              <Link href="/rates" className="text-xs text-silver-300 hover:text-foreground font-medium flex items-center gap-1">
                <span>Configure oracle feeds & spread buffers</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Payout Rails & Multi-Chain Custody Status Row ─── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Dynamic Failover Payout Rails */}
        <Card
          title="Active Payout Rail & Failover Engine"
          subtitle="Commercial bank disbursement router with hot automatic failover"
          headerAction={
            <Badge variant="success" className="font-mono text-[10px]">
              FAILOVER READY
            </Badge>
          }
        >
          <div className="space-y-3">
            {snapshot.payoutRails.map((rail) => {
              const isSelected = activeProvider === rail.id;
              return (
                <div
                  key={rail.id}
                  onClick={() => handleProviderSwitch(rail.id)}
                  className={`flex items-center justify-between rounded-xl border p-3.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-silver-400/80 bg-foreground/5 shadow-xs'
                      : 'border-border/60 bg-card/40 hover:bg-muted/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{rail.name}</span>
                      {isSelected && (
                        <Badge variant="success" className="text-[10px]">
                          ● PRIMARY
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                      <span>Latency: {rail.latencyMs}ms</span>
                      <span>•</span>
                      <span>Success: {rail.successRate}%</span>
                      <span>•</span>
                      <span>Pool: ₦{(rail.balanceNGN / 1_000_000).toFixed(1)}M</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isSelected ? 'primary' : 'outline'}
                    className="text-[11px] h-8 px-3 font-semibold"
                  >
                    {isSelected ? 'Active' : 'Set Primary'}
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground font-mono">
            <span>Failover Sequence: Paystack → Monnify → Squad</span>
            <Link href="/wallet" className="text-silver-300 hover:text-foreground font-sans text-xs">
              Manage Rails →
            </Link>
          </div>
        </Card>

        {/* Multi-Chain Custody & Deposit Listeners */}
        <Card
          title="Multi-Chain Custody Activity"
          subtitle="Deposit listeners polling Monad Metropolis RPC & Solana SPL"
          headerAction={
            <Badge variant="silver" className="font-mono text-[10px]">
              Track A Self-Custody
            </Badge>
          }
        >
          <div className="space-y-3">
            {snapshot.recentDeposits.slice(0, 3).map((dep) => (
              <div key={dep.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{dep.chain}</span>
                    <Badge variant={dep.chain.includes('Monad') ? 'silver' : 'outline'} className="text-[10px]">
                      {dep.token}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    Tx: {dep.txHash}
                  </p>
                </div>
                <div className="text-right shrink-0 pl-3">
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    +{dep.amount.toFixed(2)} {dep.token}
                  </span>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground mt-0.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span>{dep.confirmations} confs</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
            <span>Privy server wallets + RPC polling active</span>
            <Link href="/deposits" className="text-silver-300 hover:text-foreground text-xs font-medium">
              View All On-Chain Deposits →
            </Link>
          </div>
        </Card>
      </div>

      {/* ─── Recent Spend Transactions Table ─── */}
      <Card
        title="Recent Spend & Payout Transactions"
        subtitle="Real-time fiat disbursements to Nigerian bank accounts via active provider"
        headerAction={
          <div className="flex items-center gap-2">
            <Link href="/transactions">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <span>View Full Registry</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/70 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="pb-3 pt-1">Reference</th>
                <th className="pb-3 pt-1">Customer</th>
                <th className="pb-3 pt-1">Recipient Bank</th>
                <th className="pb-3 pt-1 text-right">Crypto Sent</th>
                <th className="pb-3 pt-1 text-right">Naira Disbursed</th>
                <th className="pb-3 pt-1 text-center">Rail</th>
                <th className="pb-3 pt-1 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {snapshot.recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3 font-mono text-[11px] text-foreground font-medium">
                    <Link href={`/transactions`} className="hover:underline text-silver-300">
                      {tx.reference}
                    </Link>
                  </td>
                  <td className="py-3">
                    <div className="font-medium text-foreground">{tx.userName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{tx.userEmail}</div>
                  </td>
                  <td className="py-3">
                    <div className="text-foreground">{tx.recipientBankName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {tx.recipientAccountNumber} ({tx.recipientAccountName})
                    </div>
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-foreground">
                    ${tx.amountUSDC.toFixed(2)} USDC
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-emerald-400">
                    ₦{tx.amountNGN.toLocaleString('en-NG')}
                  </td>
                  <td className="py-3 text-center">
                    <span className="rounded-md border border-border/60 bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {tx.payoutProvider}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <Badge
                      variant={
                        tx.status === 'SUCCESS'
                          ? 'success'
                          : tx.status === 'PENDING'
                          ? 'warning'
                          : 'destructive'
                      }
                      className="text-[10px]"
                    >
                      {tx.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
