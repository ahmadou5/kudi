'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Shield, ArrowRight } from 'lucide-react';

export default function SetupAdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@kudi.app');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, setupToken }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Admin setup failed');
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin setup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border border-border/80 bg-card/95 p-8 shadow-glow">
        <div className="mb-8 space-y-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-silver-400/30 bg-silver-500/10">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Create Admin</h1>
              <p className="text-xs text-muted-foreground">Requires SETUP_ADMIN_TOKEN or ADMIN_API_KEY.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@kudi.app" required />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New admin password" required minLength={6} />
          <Input type="password" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder="Setup token" required />
          {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div> : null}
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? 'Creating...' : 'Create admin'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </main>
  );
}
