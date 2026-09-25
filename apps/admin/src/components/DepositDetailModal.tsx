'use client';

import React, { useState } from 'react';
import { AdminDeposit } from '@/lib/admin-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  Info,
  Clock3,
  CheckCircle2,
  Lock,
  Wallet
} from 'lucide-react';

interface DepositDetailModalProps {
  deposit: AdminDeposit | null;
  onClose: () => void;
  onRequeue: (txHash: string) => Promise<void>;
  onRecheck: (txHash: string) => Promise<void>;
  isRequeueing?: boolean;
  isRechecking?: boolean;
}

export function DepositDetailModal({
  deposit,
  onClose,
  onRequeue,
  onRecheck,
  isRequeueing = false,
  isRechecking = false
}: DepositDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!deposit) return null;

  function copyToClipboard(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  }

  const isSolana = deposit.chain.toLowerCase().includes('solana');
  const explorerUrl = isSolana
    ? `https://explorer.solana.com/tx/${deposit.txHash}?cluster=devnet`
    : `https://testnet.monadexplorer.com/tx/${deposit.txHash}`;

  const sweepExplorerUrl = deposit.sweepTxHash
    ? isSolana
      ? `https://explorer.solana.com/tx/${deposit.sweepTxHash}?cluster=devnet`
      : `https://testnet.monadexplorer.com/tx/${deposit.sweepTxHash}`
    : null;

  // Float Model is active ONLY when there is genuinely no server key — no
  // privyWalletId on EITHER the Deposit row or the joined Wallet row
  // (server `walletCustody`). A missing key on one side alone, or an unknown
  // custody signal, is never enough to claim the float model.
  const hasServerKey =
    Boolean(deposit.privyWalletId) || deposit.walletCustody === 'SERVER_CUSTODY';
  const isFloatModel =
    !hasServerKey && deposit.walletCustody === 'NO_SERVER_KEY' && deposit.sweepStatus !== 'SWEPT';

  const custodyLabel = hasServerKey
    ? 'Server Custody (Privy KMS)'
    : isFloatModel
      ? 'Self-Custody (Float Model)'
      : 'Custody Unknown';

  // Actionable per-status guidance: retry-safe vs do-not-retry.
  const sweepStatus = deposit.sweepStatus || 'UNKNOWN';
  const attempts = deposit.sweepAttemptCount || 0;
  const guidance: { tone: 'info' | 'warn'; title: string; body: string; retrySafe: boolean } | null =
    deposit.sweepStatus === 'SWEPT'
      ? null
      : isFloatModel
        ? {
            tone: 'info',
            title: 'Float Model Active — do not retry',
            body: 'This deposit address was created without a Privy server-side key authority (user-controlled key). Kudi credited the off-chain ledger so the customer can spend immediately, while on-chain funds safely remain in the user\u2019s deposit address. Retry Sweep will fail by design — no operator action needed.',
            retrySafe: false
          }
        : sweepStatus === 'SWEEP_PROCESSING'
          ? {
              tone: 'warn',
              title: 'Sweep owned by the worker — do not retry',
              body: 'A sweep broadcast for this deposit is currently owned by the sweep worker. Re-queueing now could double-broadcast. Use Recheck Status to verify on-chain state; only requeue if the worker reports it stale or failed.',
              retrySafe: false
            }
          : sweepStatus === 'SWEEP_FAILED' || sweepStatus === 'SWEEP_BLOCKED'
            ? attempts >= 4
              ? {
                  tone: 'warn',
                  title: 'Retry exhausted — retry-safe but escalate',
                  body: `This sweep failed ${attempts} time(s) and needs operator review. Re-queueing is safe (it resets the attempt counter and clears the error), but if it fails again, escalate: check the error trace, treasury gas runway, and Privy sponsorship before further retries.`,
                  retrySafe: true
                }
              : {
                  tone: 'info',
                  title: 'Retry-safe: transient sweep failure',
                  body: `The automated sweep hit an error (${attempts} attempt(s) so far). Click Retry Sweep to trigger an immediate requeue — the attempt counter resets and the error clears. Safe to retry.`,
                  retrySafe: true
                }
            : sweepStatus === 'SWEEP_PENDING'
              ? {
                  tone: 'info',
                  title: 'Queued for sweep — no action needed',
                  body: 'This deposit is queued and the worker will pick it up automatically. Retrying is safe but unnecessary; use Recheck Status if it sits here unusually long.',
                  retrySafe: true
                }
              : {
                  tone: 'info',
                  title: 'Awaiting sweep — recheck is safe',
                  body: 'This deposit has not been swept yet. Use Recheck Status to verify on-chain state; Retry Sweep is safe once a server key is confirmed present.',
                  retrySafe: hasServerKey
                };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/80 bg-background p-6 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-border/80 bg-muted/60 p-2.5">
              <Wallet className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Transaction & Sweep Details</h2>
              <p className="text-xs text-muted-foreground font-mono">ID: {deposit.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Amount</span>
            <span className="font-mono text-base font-bold text-emerald-400">
              +{deposit.amount.toFixed(2)} {deposit.token}
            </span>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Chain</span>
            <span className="font-semibold text-xs text-foreground block mt-1">{deposit.chain}</span>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Ledger Credit</span>
            <div className="mt-1">
              <Badge variant="success" className="text-[10px]">
                CREDITED
              </Badge>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Sweep Status</span>
            <div className="mt-1">
              <Badge
                variant={deposit.sweepStatus === 'SWEPT' ? 'success' : deposit.sweepStatus === 'SWEEP_PROCESSING' ? 'silver' : 'warning'}
                className="text-[10px]"
              >
                {deposit.sweepStatus || 'UNKNOWN'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Custody Model & Wallet Info */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custody & Address Context</h3>
            <Badge variant={hasServerKey ? 'silver' : 'outline'} className="text-[10px]">
              {custodyLabel}
            </Badge>
          </div>

          <div className="grid gap-2 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-border/30">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-semibold text-foreground">{deposit.userName} ({deposit.userId})</span>
            </div>

            {deposit.walletAddress ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-border/30">
                <span className="text-muted-foreground">Deposit Wallet Address:</span>
                <div className="flex items-center gap-2 font-mono text-[11px] text-foreground">
                  <span>{deposit.walletAddress}</span>
                  <button
                    onClick={() => copyToClipboard(deposit.walletAddress!, 'walletAddress')}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Copy address"
                  >
                    {copiedField === 'walletAddress' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ) : null}

            {deposit.privyWalletId ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-border/30">
                <span className="text-muted-foreground">Privy Wallet ID:</span>
                <span className="font-mono text-[11px] text-foreground">{deposit.privyWalletId}</span>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-border/30">
              <span className="text-muted-foreground">Deposit Hash / Signature:</span>
              <div className="flex items-center gap-2 font-mono text-[11px] text-foreground">
                <span className="truncate max-w-[280px]">{deposit.txHash}</span>
                <button
                  onClick={() => copyToClipboard(deposit.txHash, 'txHash')}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Copy signature"
                >
                  {copiedField === 'txHash' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <a href={explorerUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {deposit.sweepTxHash ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-border/30">
                <span className="text-muted-foreground">Sweep Broadcast Hash:</span>
                <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-400">
                  <span className="truncate max-w-[280px]">{deposit.sweepTxHash}</span>
                  <button
                    onClick={() => copyToClipboard(deposit.sweepTxHash!, 'sweepTxHash')}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Copy sweep hash"
                  >
                    {copiedField === 'sweepTxHash' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  {sweepExplorerUrl ? (
                    <a href={sweepExplorerUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
              <span className="text-muted-foreground">Sweep Attempts:</span>
              <span className="font-mono text-foreground">{deposit.sweepAttemptCount || 0} / 5</span>
            </div>
          </div>
        </div>

        {/* Sweep Error Details Section */}
        {deposit.sweepError ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                <AlertTriangle className="h-4 w-4" />
                <span>Complete Sweep Error Trace</span>
              </div>
              <button
                onClick={() => copyToClipboard(deposit.sweepError!, 'sweepError')}
                className="flex items-center gap-1 text-[11px] text-amber-200 hover:text-white transition-colors cursor-pointer"
              >
                {copiedField === 'sweepError' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy Full Error
                  </>
                )}
              </button>
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-black/60 p-3 font-mono text-[11px] text-amber-200/90 whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto selection:bg-amber-500/40">
              {deposit.sweepError}
            </div>

            {/* Explanation Banner — actionable per-status guidance */}
            {guidance ? (
              <div className="rounded-lg border border-border/50 bg-background/80 p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className={`h-4 w-4 ${guidance.tone === 'warn' ? 'text-amber-400' : 'text-sky-400'}`} /> Explanation: {guidance.title}
                </div>
                <p className="leading-relaxed">
                  {guidance.body}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 bg-background/80 p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-amber-400" /> Explanation: Retrying via Worker
                </div>
                <p className="leading-relaxed">
                  The automated sweep job encountered a transient RPC or sponsorship error. Click &quot;Retry Sweep&quot; below to trigger an immediate retry.
                </p>
              </div>
            )}
          </div>
        ) : deposit.sweepStatus === 'SWEPT' ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="text-xs text-emerald-200">
              <span className="font-semibold block">Sweep Completed</span>
              This deposit has been successfully swept to Kudi&apos;s central treasury.
            </div>
          </div>
        ) : guidance ? (
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold block text-foreground">{guidance.title}</span>
              {guidance.body}
            </div>
          </div>
        ) : null}

        {/* Modal Action Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-border/60 pt-4">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto text-xs">
            Close
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto text-xs gap-1.5"
            disabled={isRechecking}
            onClick={() => onRecheck(deposit.txHash)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRechecking ? 'animate-spin' : ''}`} />
            {isRechecking ? 'Checking...' : 'Recheck Status'}
          </Button>

          {deposit.sweepStatus !== 'SWEPT' && (!guidance || guidance.retrySafe) ? (
            <Button
              size="sm"
              className="w-full sm:w-auto text-xs gap-1.5"
              disabled={isRequeueing}
              onClick={() => onRequeue(deposit.txHash)}
              title={guidance && !guidance.retrySafe ? guidance.body : 'Requeue this sweep'}
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isRequeueing ? 'animate-spin' : ''}`} />
              {isRequeueing ? 'Re-queueing...' : 'Retry Sweep'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
