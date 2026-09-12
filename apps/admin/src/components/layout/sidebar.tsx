'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Repeat,
  Layers,
  Users,
  ShieldCheck,
  Building2,
  TrendingUp,
  Sliders,
  Bell,
  Settings,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const navGroups = [
  {
    title: 'Operations',
    items: [
      { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, exact: true },
      { href: '/transactions', label: 'Spend Transactions', Icon: Repeat, exact: false },
      { href: '/deposits', label: 'On-Chain Deposits', Icon: Layers, exact: false },
      { href: '/users', label: 'Users & Wallets', Icon: Users, exact: false },
      { href: '/kyc', label: 'KYC Compliance Desk', Icon: ShieldCheck, exact: false },
    ],
  },
  {
    title: 'Treasury & Rails',
    items: [
      { href: '/wallet', label: 'Payout Rails & Failover', Icon: Building2, exact: false },
      { href: '/rates', label: 'Rate Engine & Spreads', Icon: TrendingUp, exact: false },
      { href: '/chains', label: 'Custody & Chain Config', Icon: Sliders, exact: false },
    ],
  },
  {
    title: 'Communications & System',
    items: [
      { href: '/notifications', label: 'Broadcast Alerts', Icon: Bell, exact: false },
      { href: '/settings', label: 'System Health & Settings', Icon: Settings, exact: false },
    ],
  },
];

function isRouteActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<{ name: string; email: string; initials: string } | null>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const getCookie = (name: string) => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? decodeURIComponent(match[2]) : null;
    };
    try {
      const raw = getCookie('kudi_admin_user');
      if (raw) {
        const user = JSON.parse(raw);
        const name = (user.name ?? user.fullName ?? 'Administrator').trim();
        const email = (user.email ?? 'admin@kudi.app').trim();
        const initials = name
          .split(' ')
          .filter(Boolean)
          .map((w: string) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'AD';
        setAdminUser({ name, email, initials });
      } else {
        setAdminUser({ name: 'Ops Administrator', email: 'admin@kudi.app', initials: 'OA' });
      }
    } catch {
      setAdminUser({ name: 'Ops Administrator', email: 'admin@kudi.app', initials: 'OA' });
    }
  }, []);

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between pb-6 pt-1 border-b border-border/70">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-silver-400/30 bg-silver-500/10 text-foreground shadow-xs font-display text-2xl font-black">
              K
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-bold tracking-tight text-foreground">Kudi</span>
                <span className="rounded-full border border-silver-400/30 bg-silver-500/10 px-2 py-0.2 text-[10px] font-mono font-bold text-silver-300">
                  METROPOLIS
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium -mt-1">Internal Ops Console</p>
            </div>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Categories */}
        <nav className="mt-6 space-y-6">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
                {group.title}
              </p>
              <div className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const active = isRouteActive(pathname, item.href, item.exact);
                  const Icon = item.Icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all group',
                        active
                          ? 'bg-foreground text-background font-semibold shadow-xs'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0 transition-transform group-hover:scale-110', active ? 'text-background' : 'text-muted-foreground group-hover:text-foreground')} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer / User Profile Card */}
      <div className="border-t border-border/70 pt-4 space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-2.5 shadow-xs">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-silver-400/20 bg-muted font-mono text-xs font-bold text-foreground">
            {adminUser?.initials || 'OA'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{adminUser?.name || 'Administrator'}</p>
            <p className="truncate text-[11px] text-muted-foreground font-mono">{adminUser?.email || 'admin@kudi.app'}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-1 text-[10px] font-mono text-muted-foreground">
          <span>Track A · Self-Custody</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navbar Bar with Hamburger */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-silver-500/10 border border-silver-400/30 font-display text-lg font-bold">
            K
          </div>
          <span className="font-display text-xl font-bold text-foreground">Kudi Ops</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="rounded-xl border border-border/80 bg-card p-2 text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border/80 bg-background/95 min-h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-background border-r border-border/80 shadow-glow animate-fade-in z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
