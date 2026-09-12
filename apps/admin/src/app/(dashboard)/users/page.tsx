'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { loadUsers, AdminUser } from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, Users, ShieldCheck, ArrowRight, Wallet } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');

  useEffect(() => {
    loadUsers().then((data) => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  const filtered = users.filter((u) => {
    if (tierFilter !== 'ALL' && u.kycTier !== tierFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phoneNumber.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Stat Pills */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Total Registered Users
          </span>
          <p className="font-mono text-2xl font-bold text-foreground mt-1">{users.length}</p>
        </Card>
        <Card className="p-4">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Tier 2 KYC Verified (NIN/BVN)
          </span>
          <p className="font-mono text-2xl font-bold text-emerald-400 mt-1">
            {users.filter((u) => u.kycTier === 'TIER_2').length}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Total Float Balance
          </span>
          <p className="font-mono text-2xl font-bold text-silver-300 mt-1">
            ${users.reduce((acc, u) => acc + u.balanceUSDC, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
          </p>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 max-w-md flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, email, or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'TIER_2', 'TIER_1', 'UNVERIFIED'].map((tier) => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                tierFilter === tier
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="No customer accounts matched your filter criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/70 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Customer Profile</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3 text-center">KYC Tier</th>
                  <th className="px-4 py-3 text-center">KYC Status</th>
                  <th className="px-4 py-3 text-right">Float Balance</th>
                  <th className="px-4 py-3 text-right">Total NGN Spent</th>
                  <th className="px-4 py-3 text-center">Wallets</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-foreground">{u.fullName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-muted-foreground">
                      {u.phoneNumber}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="rounded-md border border-border/80 bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-foreground">
                        {u.kycTier}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge
                        variant={
                          u.kycStatus === 'VERIFIED'
                            ? 'success'
                            : u.kycStatus === 'PENDING'
                            ? 'warning'
                            : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {u.kycStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-foreground">
                      ${u.balanceUSDC.toFixed(2)} USDC
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400">
                      ₦{u.totalSpendNGN.toLocaleString('en-NG')}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono text-[11px] text-muted-foreground">
                      {u.wallets.length} chains
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link href={`/users/${u.id}`}>
                        <Button variant="ghost" size="sm" className="gap-1 text-silver-300 hover:text-foreground text-xs">
                          <span>Manage</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
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
