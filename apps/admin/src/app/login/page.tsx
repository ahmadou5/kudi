'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Shield, Sparkles, Lock, ArrowRight } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/dashboard';
  const [email, setEmail] = useState('admin@kudi.app');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? 'Invalid administrator credentials');
      }

      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center px-4 py-8 bg-background">
      <div className="absolute inset-0 bg-brand-grid opacity-30 pointer-events-none" aria-hidden="true" />

      {/* Decorative gradient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-silver-500/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="relative w-full max-w-md overflow-hidden border border-border/80 bg-card/95 p-8 shadow-glow backdrop-blur-xl">
        {/* Brand Banner */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-silver-400/30 bg-silver-500/10 shadow-md font-display text-2xl font-black text-foreground">
                K
              </div>
              <div>
                <span className="font-display text-2xl font-bold tracking-tight text-foreground">KUDI</span>
                <span className="block text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                  Metropolis Ops
                </span>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-silver-400/20 bg-muted px-2.5 py-1 text-[10px] font-mono text-silver-300">
              <Shield className="h-3 w-3 text-emerald-400" />
              <span>Track A Active</span>
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground pt-2">
            Operations Console
          </h1>
          <p className="text-xs leading-5 text-muted-foreground">
            Sign in to manage liquidity rails, custody wallets, real-time rate overrides, and compliance audits.
          </p>
        </div>

        {/* Login Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-foreground">
              Administrator Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@kudi.app"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-xs font-semibold text-foreground">
                Password
              </label>
              <span className="text-[11px] font-mono text-muted-foreground">Default: admin123</span>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full h-10 mt-2 font-bold gap-2">
            <span>Sign In to Console</span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          <div className="rounded-xl border border-border/50 bg-muted/40 p-3 mt-4 text-[11px] text-muted-foreground flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Connected to Monad Metropolis Hackathon environment. Pre-seeded with realistic multi-provider failover rails.
            </span>
          </div>
        </form>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background text-sm">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
