'use client';

import React, { useState, useEffect } from 'react';
import { loadTransactions, AdminSpendTransaction } from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Search,
  Download,
  Filter,
  Repeat,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  X,
  FileText,
} from 'lucide-react';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<AdminSpendTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED'>('ALL');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<AdminSpendTransaction | null>(null);

  useEffect(() => {
    loadTransactions().then((data) => {
      setTransactions(data);
      setLoading(false);
    });
  }, []);

  const filteredTxs = transactions.filter((tx) => {
    if (statusFilter !== 'ALL' && tx.status !== statusFilter) return false;
    if (providerFilter !== 'ALL' && tx.payoutProvider !== providerFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        tx.reference.toLowerCase().includes(q) ||
        tx.userName.toLowerCase().includes(q) ||
        tx.recipientAccountNumber.includes(q) ||
        tx.recipientBankName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportCSV = () => {
    window.open('http://localhost:4000/api/v1/admin/reconciliation/export-csv', '_blank');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Search and Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search reference, customer, or account number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCSV} className="gap-2 text-xs">
            <Download className="h-4 w-4" />
            <span>Export Reconciliation CSV</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-3">
        <div className="flex items-center gap-1.5">
          {(['ALL', 'SUCCESS', 'PENDING', 'FAILED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Filter Rail:</span>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="rounded-lg border border-border/80 bg-card px-2.5 py-1 text-xs text-foreground focus:outline-none"
          >
            <option value="ALL">All Providers</option>
            <option value="PAYSTACK">Paystack</option>
            <option value="MONNIFY">Monnify</option>
            <option value="SQUAD">Squad</option>
          </select>
        </div>
      </div>

      {/* Transaction Table */}
      <Card className="overflow-hidden p-0">
        {filteredTxs.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="No transactions found"
            description="No spend transactions matched your selected filters or search query."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/70 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Reference / Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Beneficiary Account</th>
                  <th className="px-4 py-3 text-right">Crypto Sent</th>
                  <th className="px-4 py-3 text-right">Rate & Fee</th>
                  <th className="px-4 py-3 text-right">Naira Disbursed</th>
                  <th className="px-4 py-3 text-center">Provider</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-bold text-foreground text-[11px]">
                        {tx.reference}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{tx.createdAt}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-foreground">{tx.userName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{tx.userEmail}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-foreground">{tx.recipientBankName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {tx.recipientAccountNumber} · {tx.recipientAccountName}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-foreground">
                      ${tx.amountUSDC.toFixed(2)} USDC
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-muted-foreground text-[11px]">
                      <div>₦{tx.exchangeRateNGN.toFixed(2)}/USDC</div>
                      <div className="text-[10px] text-muted-foreground/80">Fee: ₦{tx.feeNGN}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400">
                      ₦{tx.amountNGN.toLocaleString('en-NG')}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="rounded-md border border-border/60 bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {tx.payoutProvider}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
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
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTx(tx)}
                        className="text-xs text-silver-300 hover:text-foreground"
                      >
                        View Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Transaction Detail Drawer / Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
          <div className="fixed inset-0" onClick={() => setSelectedTx(null)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-glow backdrop-blur-xl z-10 animate-slide-up">
            <div className="flex items-center justify-between pb-4 border-b border-border/70">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-display text-xl font-bold text-foreground">Transaction Audit Trail</h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <span className="text-muted-foreground font-semibold">Status:</span>
                <Badge
                  variant={
                    selectedTx.status === 'SUCCESS'
                      ? 'success'
                      : selectedTx.status === 'PENDING'
                      ? 'warning'
                      : 'destructive'
                  }
                >
                  {selectedTx.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                    Disbursed Amount
                  </span>
                  <p className="font-mono text-lg font-bold text-emerald-400 mt-1">
                    ₦{selectedTx.amountNGN.toLocaleString('en-NG')}
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    ${selectedTx.amountUSDC.toFixed(2)} USDC @ ₦{selectedTx.exchangeRateNGN.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                    Rail & Router
                  </span>
                  <p className="font-mono text-lg font-bold text-foreground mt-1">
                    {selectedTx.payoutProvider}
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    Transaction Fee: ₦{selectedTx.feeNGN}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-border/60 p-3.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="font-mono font-bold text-foreground">{selectedTx.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold text-foreground">{selectedTx.userName} ({selectedTx.userEmail})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Beneficiary Bank:</span>
                  <span className="text-foreground">{selectedTx.recipientBankName} ({selectedTx.recipientBankCode})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account Number:</span>
                  <span className="font-mono text-foreground font-bold">{selectedTx.recipientAccountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account Name:</span>
                  <span className="text-foreground font-medium">{selectedTx.recipientAccountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created At:</span>
                  <span className="font-mono text-foreground">{selectedTx.createdAt}</span>
                </div>
                {selectedTx.failureReason && (
                  <div className="mt-2 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-destructive">
                    <span className="font-bold block">Failure Reason:</span>
                    {selectedTx.failureReason}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(`http://localhost:4000/api/v1/payout/receipt/${selectedTx.reference}`, '_blank')}
                  className="gap-1.5"
                >
                  <FileText className="h-4 w-4" />
                  <span>Digital Receipt</span>
                </Button>
                <Button variant="primary" onClick={() => setSelectedTx(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
