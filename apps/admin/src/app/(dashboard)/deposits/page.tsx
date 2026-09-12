'use client';

import React, { useState, useEffect } from 'react';
import { loadDeposits, AdminDeposit } from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, Layers, ExternalLink, CheckCircle2, RefreshCw } from 'lucide-react';

export default function DepositsPage() {
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainFilter, setChainFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDeposits().then((data) => {
      setDeposits(data);
      setLoading(false);
    });
  }, []);

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
              instantly credit customer balances in the float ledger.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-xl border border-border/60 bg-card p-3 text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Total Monad AUSD Received
              </span>
              <span className="font-mono text-base font-bold text-emerald-400">$148,250.00</span>
            </div>
          </div>
        </div>
      </div>

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
