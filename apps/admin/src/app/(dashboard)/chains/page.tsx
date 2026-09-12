'use client';

import React, { useState, useEffect } from 'react';
import { loadChainConfigs, AdminChainItem } from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sliders, CheckCircle2, Shield, AlertTriangle, Layers } from 'lucide-react';

export default function ChainsConfigPage() {
  const [chains, setChains] = useState<AdminChainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [track, setTrack] = useState<'TRACK_A' | 'TRACK_B'>('TRACK_A');

  useEffect(() => {
    loadChainConfigs().then((data) => {
      setChains(data);
      setLoading(false);
    });
  }, []);

  const toggleChain = (id: string) => {
    setChains((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
    setNotice(`Updated status for ${id}`);
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Track A vs Track B Custody Mode Selector */}
      <div className="rounded-2xl border border-silver-400/20 bg-muted/40 p-5 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              <h3 className="font-display text-xl font-bold text-foreground">Custody Architecture Mode</h3>
              <Badge variant="silver" className="font-mono text-[10px]">
                SRS §1.6 Compliant
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Kudi supports two swappable custody paradigms. Track A leverages self-custodied Privy embedded server keys for
              hackathon and immediate operations. Track B transitions to a licensed VASP partner for scaled institutional custody.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-card p-1.5 rounded-xl border border-border/70 shrink-0">
            <button
              onClick={() => setTrack('TRACK_A')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                track === 'TRACK_A'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Track A (Self-Custody)
            </button>
            <button
              onClick={() => setTrack('TRACK_B')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                track === 'TRACK_B'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Track B (Licensed VASP)
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Chains Configuration List */}
      <Card
        title="Active Deposit Listeners & RPC Endpoints"
        subtitle="Config-driven listener workers ingest incoming token transfers automatically"
      >
        <div className="space-y-4">
          {chains.map((chain) => (
            <div
              key={chain.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4 transition-all"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-display text-lg font-bold text-foreground">{chain.name}</span>
                  <Badge variant={chain.type === 'EVM' ? 'silver' : 'outline'} className="text-[10px]">
                    {chain.type}
                  </Badge>
                  <span className="font-mono text-xs font-bold text-emerald-400">{chain.token}</span>
                </div>
                <p className="font-mono text-xs text-muted-foreground truncate">
                  RPC: {chain.rpcUrl}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground/80 truncate">
                  Contract: {chain.contractAddress} · Block Threshold: {chain.confirmationThreshold} confirmations
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Badge variant={chain.enabled ? 'success' : 'destructive'} className="text-[11px]">
                  {chain.enabled ? 'ONLINE & POLLING' : 'DISABLED'}
                </Badge>
                <Button
                  size="sm"
                  variant={chain.enabled ? 'destructive' : 'primary'}
                  onClick={() => toggleChain(chain.id)}
                  className="text-xs h-8 px-3 font-semibold"
                >
                  {chain.enabled ? 'Deactivate' : 'Activate Chain'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
