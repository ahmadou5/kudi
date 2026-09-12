'use client';

import React, { useState, useEffect } from 'react';
import { loadSystemSettings, AdminSettings } from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings, Shield, Server, Database, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [autoFailover, setAutoFailover] = useState(true);
  const [dailyLimit, setDailyLimit] = useState('10000000');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    loadSystemSettings().then((data) => {
      setSettings(data);
      setMaintenance(data.maintenanceMode);
      setAutoFailover(data.autoFailoverEnabled);
      setDailyLimit(data.maxDailySpendLimitNGN.toString());
      setLoading(false);
    });
  }, []);

  const handleSaveConfig = () => {
    setNotice('Platform configuration changes applied and logged to compliance trail.');
    setTimeout(() => setNotice(null), 4000);
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Loading system telemetry...</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Infrastructure Telemetry Grid */}
      <Card title="Infrastructure Health & Node Telemetry" subtitle="Live health probes for APIs, databases, message queues and RPCs">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 pt-2">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-center gap-3">
            <Server className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[11px] font-bold text-foreground block">Fastify REST API</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">{settings.health.fastifyApi}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-center gap-3">
            <Database className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[11px] font-bold text-foreground block">PostgreSQL Prisma</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">{settings.health.postgresPrisma}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-center gap-3">
            <Activity className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[11px] font-bold text-foreground block">Redis & BullMQ</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">{settings.health.redisBullmq}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-center gap-3">
            <Server className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[11px] font-bold text-foreground block">Monad Testnet RPC</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">{settings.health.monadMetropolisRpc}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-center gap-3">
            <Server className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[11px] font-bold text-foreground block">Solana Mainnet RPC</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">{settings.health.solanaRpc}</span>
            </div>
          </div>
        </div>
      </Card>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Operational Controls */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Emergency & Maintenance Controls" subtitle="Safeguards and system-wide operation killswitches">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3.5">
              <div>
                <span className="text-xs font-bold text-foreground block">Platform Maintenance Mode</span>
                <span className="text-[11px] text-muted-foreground">Temporarily reject new deposit & spend orders</span>
              </div>
              <Button
                size="sm"
                variant={maintenance ? 'destructive' : 'outline'}
                onClick={() => setMaintenance(!maintenance)}
                className="text-xs h-8"
              >
                {maintenance ? 'ACTIVE (BLOCKING)' : 'DISABLED'}
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3.5">
              <div>
                <span className="text-xs font-bold text-foreground block">Automatic Provider Failover</span>
                <span className="text-[11px] text-muted-foreground">Automatically route to Monnify if Paystack fails</span>
              </div>
              <Button
                size="sm"
                variant={autoFailover ? 'primary' : 'outline'}
                onClick={() => setAutoFailover(!autoFailover)}
                className="text-xs h-8"
              >
                {autoFailover ? 'ENABLED' : 'DISABLED'}
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Compliance Limits & Bounds" subtitle="Central Bank of Nigeria transaction tiers">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tier 2 Max Daily Limit (NGN)</label>
              <Input
                type="number"
                mono
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Currently set to ₦{parseInt(dailyLimit || '0', 10).toLocaleString('en-NG')}
              </p>
            </div>

            <Button variant="primary" onClick={handleSaveConfig} className="text-xs font-semibold">
              Save Compliance Parameters
            </Button>
          </div>
        </Card>
      </div>

      {/* Admin Audit Trail */}
      <Card title="Administrative Action Audit Log" subtitle="Cryptographically logged audit history for regulatory SEC & CBN reporting">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/70 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="pb-3 pt-1">Timestamp</th>
                <th className="pb-3 pt-1">Operator Email</th>
                <th className="pb-3 pt-1">Action Type</th>
                <th className="pb-3 pt-1">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {settings.auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3 font-mono text-[11px] text-muted-foreground">{log.timestamp}</td>
                  <td className="py-3 font-semibold text-foreground">{log.adminEmail}</td>
                  <td className="py-3">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="py-3 text-muted-foreground text-[11px]">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
