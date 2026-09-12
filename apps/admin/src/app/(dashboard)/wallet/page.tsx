'use client';

import React, { useState, useEffect } from 'react';
import { loadPayoutRails, AdminPayoutRail } from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, CheckCircle2, Download, ShieldCheck, Zap, ArrowRight } from 'lucide-react';

export default function WalletRailsPage() {
  const [rails, setRails] = useState<AdminPayoutRail[]>([]);
  const [activeRailId, setActiveRailId] = useState<string>('PAYSTACK');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadPayoutRails().then((data) => {
      setRails(data);
      const active = data.find((r) => r.active);
      if (active) setActiveRailId(active.id);
      setLoading(false);
    });
  }, []);

  const handleSetActive = async (id: string) => {
    try {
      await fetch('/api/admin/set-active-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: id }),
      });
      setActiveRailId(id);
      setFeedback(`Active primary payout rail switched to ${id}`);
      setTimeout(() => setFeedback(null), 4000);
    } catch {
      setActiveRailId(id);
      setFeedback(`Active primary payout rail switched to ${id} (mock mode)`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const exportCSV = () => {
    window.open('http://localhost:4000/api/v1/admin/reconciliation/export-csv', '_blank');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Information and Quick Export Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-silver-400/20 bg-muted/40 p-5 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-400" />
            <h3 className="font-display text-xl font-bold text-foreground">Multi-Provider Payout Rails & Treasury</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Transfers are routed via the primary active provider. If timeouts or gateway downtime occurs, the registry
            automatically fails over through the configured sequence: Paystack → Monnify → Squad.
          </p>
        </div>
        <Button variant="primary" onClick={exportCSV} className="gap-2 shrink-0 text-xs font-semibold">
          <Download className="h-4 w-4" />
          <span>Export Compliance Audit CSV</span>
        </Button>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Provider Rails Cards Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {rails.map((rail) => {
          const isPrimary = activeRailId === rail.id;
          return (
            <Card
              key={rail.id}
              className={`relative overflow-hidden transition-all ${
                isPrimary
                  ? 'border-silver-400/80 bg-card shadow-glow-sm'
                  : 'border-border/60 hover:border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl font-bold text-foreground">{rail.name}</span>
                </div>
                {isPrimary ? (
                  <Badge variant="success" className="text-[10px]">
                    ● ACTIVE PRIMARY
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    HOT STANDBY
                  </Badge>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <div className="rounded-xl bg-muted/40 p-3 border border-border/40">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                    Available Float Pool
                  </span>
                  <p className="font-mono text-xl font-bold text-emerald-400 mt-0.5">
                    ₦{(rail.balanceNGN).toLocaleString('en-NG')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="rounded-lg border border-border/40 p-2 text-center">
                    <span className="text-[10px] text-muted-foreground block">Latency</span>
                    <span className="font-bold text-foreground">{rail.latencyMs}ms</span>
                  </div>
                  <div className="rounded-lg border border-border/40 p-2 text-center">
                    <span className="text-[10px] text-muted-foreground block">Success</span>
                    <span className="font-bold text-emerald-400">{rail.successRate}%</span>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
                  <span className="font-semibold block text-foreground">Supported Rails:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {rail.supportedRails.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2">
                  <Button
                    variant={isPrimary ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => handleSetActive(rail.id)}
                    className="w-full text-xs font-semibold"
                  >
                    {isPrimary ? 'Currently Primary Rail' : 'Set as Primary Rail'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Failover Logic Visualization */}
      <Card
        title="Dynamic Multi-Provider Failover Architecture"
        subtitle="Automatic failover rules triggered when 5xx errors or latency thresholds exceed limits"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border/60 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-card border border-border font-bold">1</div>
            <div>
              <span className="font-semibold text-foreground text-sm">Paystack Transfers</span>
              <p className="text-[11px] text-muted-foreground">Primary Rail (Priority 1)</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-card border border-border font-bold">2</div>
            <div>
              <span className="font-semibold text-foreground text-sm">Monnify Direct</span>
              <p className="text-[11px] text-muted-foreground">Secondary Hot Standby (Priority 2)</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-card border border-border font-bold">3</div>
            <div>
              <span className="font-semibold text-foreground text-sm">Squad GTCO</span>
              <p className="text-[11px] text-muted-foreground">Tertiary Fallback (Priority 3)</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
