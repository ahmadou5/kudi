'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Search, Bell, Sun, Moon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommandSearchModal } from './command-search-modal';

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('kudi_theme');
    if (stored === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kudi_theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kudi_theme', 'dark');
      setIsDark(true);
    }
  };

  const titleMap: Record<string, { title: string; subtitle: string }> = {
    '/dashboard': {
      title: 'Operations Dashboard',
      subtitle: 'Real-time telemetry for multi-chain deposits, rate oracle feeds, and NGN payouts',
    },
    '/transactions': {
      title: 'Spend & Payout Transactions',
      subtitle: 'Audit log of crypto-to-Naira disbursements to Nigerian commercial bank accounts',
    },
    '/deposits': {
      title: 'On-Chain Custody Deposits',
      subtitle: 'Live listener feeds from Monad Metropolis Testnet (AUSD) and Solana (USDC)',
    },
    '/users': {
      title: 'Customer Directory & Accounts',
      subtitle: 'Manage user profiles, linked deposit wallets, virtual accounts, and ledger float',
    },
    '/kyc': {
      title: 'KYC Compliance Desk',
      subtitle: 'Smile Identity BVN/NIN identity verification and biometric selfie liveness queue',
    },
    '/wallet': {
      title: 'Payout Rails & Failover',
      subtitle: 'Configure primary payout rail (Paystack, Monnify, Squad) and treasury liquidity',
    },
    '/rates': {
      title: 'Rate Engine & Spreads',
      subtitle: 'Live Binance & Bybit P2P market price polling and manual rate overrides',
    },
    '/chains': {
      title: 'Custody & Chain Configuration',
      subtitle: 'Manage RPC endpoints, token contracts, and confirmation thresholds dynamically',
    },
    '/notifications': {
      title: 'Broadcast Alerts & Push Notifications',
      subtitle: 'Dispatch transactional alerts and marketing messages to Expo mobile wallets',
    },
    '/settings': {
      title: 'System Health & Settings',
      subtitle: 'Platform infrastructure status, maintenance mode toggles, and compliance audit logs',
    },
  };

  const section = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  const pageMeta =
    pathname.includes('/users/')
      ? { title: 'User Account Details', subtitle: 'Detailed profile, custody addresses, and ledger activity' }
      : pathname.includes('/transactions/')
      ? { title: 'Transaction Details', subtitle: 'Disbursement settlement trail and banking proof of payment' }
      : titleMap[pathname] ?? titleMap[`/${section}`] ?? {
          title: 'Operations Console',
          subtitle: 'Kudi Metropolis admin operations and treasury management',
        };

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const handleExportCSV = () => {
    window.open('http://localhost:4000/api/v1/admin/reconciliation/export-csv', '_blank');
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur-xl md:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          {/* Title & Subtitle */}
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {pageMeta.title}
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {pageMeta.subtitle}
            </p>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center gap-2.5">
            {/* Command Search Bar Pill */}
            <button
              id="global-search-trigger"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-xs transition-all hover:border-silver-400/40 hover:text-foreground focus:outline-none cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Search anything...</span>
              <kbd className="ml-1 rounded border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                ⌘K
              </kbd>
            </button>

            {/* Quick Export Button */}
            <button
              onClick={handleExportCSV}
              title="Download Compliance Audit CSV"
              className="hidden md:flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground shadow-xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Audit CSV</span>
            </button>

            {/* Theme Toggler Button */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border/80 bg-card text-foreground transition-all hover:bg-muted focus:outline-none shadow-xs cursor-pointer"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-foreground" />}
            </button>

            {/* Notification Bell Badge */}
            <button
              onClick={() => router.push('/notifications')}
              className="relative grid h-9 w-9 place-items-center rounded-xl border border-border/80 bg-card text-muted-foreground transition-colors hover:text-foreground shadow-xs cursor-pointer"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            {/* Sign Out Trigger */}
            <Button
              variant="secondary"
              onClick={handleLogout}
              className="h-9 rounded-xl px-3 text-xs font-semibold text-destructive hover:bg-destructive/10 border-border/80 shadow-xs"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Global Command Search Modal */}
      <CommandSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
