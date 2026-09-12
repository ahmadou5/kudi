'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getUserDetail, AdminUser } from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ShieldCheck,
  Wallet,
  Building2,
  Copy,
  CheckCircle2,
  ExternalLink,
  Lock,
} from 'lucide-react';

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    getUserDetail(userId).then((data) => {
      setUser(data);
      setLoading(false);
    });
  }, [userId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleUpdateKyc = async (newStatus: 'VERIFIED' | 'REJECTED', newTier: 'TIER_1' | 'TIER_2') => {
    if (!user) return;
    setUser({ ...user, kycStatus: newStatus, kycTier: newTier });
    setActionNotice(`Updated ${user.fullName} to ${newTier} (${newStatus})`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  if (loading || !user) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Loading customer profile...</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Back link */}
      <div>
        <Link href="/users" className="inline-flex items-center gap-1.5 text-xs text-silver-300 hover:text-foreground font-semibold">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Users Directory</span>
        </Link>
      </div>

      {actionNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* User Header Profile Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-silver-400/30 bg-silver-500/10 font-display text-3xl font-bold text-foreground">
              {user.fullName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl font-bold text-foreground">{user.fullName}</h2>
                <Badge variant={user.kycStatus === 'VERIFIED' ? 'success' : 'warning'}>
                  {user.kycStatus}
                </Badge>
                <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-bold">
                  {user.kycTier}
                </span>
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                {user.email} · {user.phoneNumber} · Member since {user.createdAt}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateKyc('VERIFIED', 'TIER_2')}
              className="text-xs font-semibold gap-1.5"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Verify Tier 2</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleUpdateKyc('VERIFIED', 'TIER_1')}
              className="text-xs font-semibold"
            >
              Set Tier 1
            </Button>
          </div>
        </div>
      </Card>

      {/* Financial Metrics Row */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="p-4">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Current Spendable Float
          </span>
          <p className="font-mono text-2xl font-bold text-foreground mt-1">
            ${user.balanceUSDC.toFixed(2)} USDC
          </p>
          <span className="text-[11px] text-muted-foreground">≈ ₦{(user.balanceUSDC * 1585.5).toLocaleString('en-NG')}</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Total Fiat Disbursed
          </span>
          <p className="font-mono text-2xl font-bold text-emerald-400 mt-1">
            ₦{user.totalSpendNGN.toLocaleString('en-NG')}
          </p>
          <span className="text-[11px] text-muted-foreground">{user.spendCount} total transactions</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Daily Transfer Limit
          </span>
          <p className="font-mono text-2xl font-bold text-silver-300 mt-1">
            {user.kycTier === 'TIER_2' ? '₦10,000,000' : user.kycTier === 'TIER_1' ? '₦1,000,000' : '₦100,000'}
          </p>
          <span className="text-[11px] text-muted-foreground">Enforced via SEC/CBN tiers</span>
        </Card>
      </div>

      {/* Linked Custody Wallets and Virtual Accounts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Linked Deposit Wallets */}
        <Card
          title="Self-Custody Deposit Wallets"
          subtitle="Privy embedded server keys mapped to user account"
          headerAction={
            <Badge variant="silver" className="font-mono text-[10px]">
              Track A
            </Badge>
          }
        >
          <div className="space-y-3">
            {user.wallets.map((w, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">{w.chain}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">Deposit Rail</span>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground truncate mt-1">
                    {w.address}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(w.address)}
                  className="shrink-0 h-8 px-2 text-silver-300 hover:text-foreground"
                >
                  {copiedAddress === w.address ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Dedicated Virtual Bank Accounts */}
        <Card
          title="Dedicated Virtual NGN Accounts"
          subtitle="Direct deposit bank accounts issued for automated NGN funding"
          headerAction={
            <Badge variant="outline" className="font-mono text-[10px]">
              Wema / Paystack
            </Badge>
          }
        >
          {user.virtualAccounts.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No virtual accounts issued for this user yet.
            </div>
          ) : (
            <div className="space-y-3">
              {user.virtualAccounts.map((va, i) => (
                <div key={i} className="rounded-xl border border-border/70 bg-muted/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{va.bankName}</span>
                    <Badge variant="success" className="text-[10px]">
                      ACTIVE
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between font-mono">
                    <span className="text-base font-bold text-foreground">{va.accountNumber}</span>
                    <span className="text-xs text-muted-foreground">{va.accountName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
