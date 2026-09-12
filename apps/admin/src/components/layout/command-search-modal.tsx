'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  Users,
  Layers,
  Repeat,
  ShieldCheck,
  Building2,
  Sliders,
  Bell,
  Settings,
  X,
  ChevronRight,
  TrendingUp,
  Download,
} from 'lucide-react';

const SEARCH_ITEMS = [
  { href: '/dashboard', title: 'Dashboard', sub: 'Operations overview & KPI metrics', category: 'Pages', Icon: LayoutDashboard },
  { href: '/transactions', title: 'Spend Transactions', sub: 'Fiat NIP disbursements to Nigerian banks', category: 'Pages', Icon: Repeat },
  { href: '/deposits', title: 'On-Chain Deposits', sub: 'Monad Metropolis AUSD & Solana USDC feeds', category: 'Pages', Icon: Layers },
  { href: '/users', title: 'User Accounts', sub: 'Customer directory & wallet balances', category: 'Pages', Icon: Users },
  { href: '/kyc', title: 'KYC Compliance Desk', sub: 'Smile Identity BVN/NIN & liveness reviews', category: 'Compliance', Icon: ShieldCheck },
  { href: '/wallet', title: 'Payout Rails & Treasury', sub: 'Paystack, Monnify, Squad failover switch', category: 'Finance', Icon: Building2 },
  { href: '/rates', title: 'Rate Engine & FX Oracle', sub: 'Binance & Bybit P2P spread overrides', category: 'Finance', Icon: TrendingUp },
  { href: '/chains', title: 'Chain Configurations', sub: 'Monad & EVM listener contract parameters', category: 'Infrastructure', Icon: Sliders },
  { href: '/notifications', title: 'Broadcast Alerts', sub: 'Push alerts & email to customer wallets', category: 'Tools', Icon: Bell },
  { href: '/settings', title: 'System Settings', sub: 'Maintenance mode & health telemetry', category: 'Settings', Icon: Settings },
];

export function CommandSearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  // Keyboard shortcut listener (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          const searchBtn = document.getElementById('global-search-trigger');
          searchBtn?.click();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = SEARCH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.sub.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const navigateTo = (href: string) => {
    onClose();
    setQuery('');
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border/80 bg-card p-0 shadow-glow backdrop-blur-xl z-10 animate-slide-up">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3.5">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a page, command or action..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Result List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-border/30">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching commands or pages found for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.Icon;
              return (
                <button
                  key={item.href}
                  onClick={() => navigateTo(item.href)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted/70 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg border border-border/80 bg-muted/60 text-muted-foreground group-hover:text-foreground group-hover:border-silver-400/40 transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <span>{item.title}</span>
                        <span className="rounded-full bg-muted px-2 py-0.2 text-[10px] font-mono text-muted-foreground">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{item.sub}</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-border/80 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          <span>Navigate using ⌘K / Esc to dismiss</span>
          <span className="font-mono">Kudi Ops v1.0</span>
        </div>
      </div>
    </div>
  );
}
