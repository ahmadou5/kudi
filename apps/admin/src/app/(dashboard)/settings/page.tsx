'use client';

import React, { useState, useEffect } from 'react';
import { loadSystemSettings, loadMaintenanceConfig, updateMaintenanceConfig, loadSweepConfig, updateSweepConfig, AdminSettings, AdminSweepConfig } from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Settings,
  Shield,
  Server,
  Database,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Power,
  PowerOff,
  Clock,
  MessageSquare,
  Zap,
  Coins,
  ShieldCheck
} from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "We're currently upgrading Metropolis to bring you improved performance and security. Services will resume shortly."
  );
  const [maintenanceDuration, setMaintenanceDuration] = useState<number | ''>(30);
  const [maintenanceUpdatedAt, setMaintenanceUpdatedAt] = useState<string | null>(null);
  const [maintenanceConfirmModal, setMaintenanceConfirmModal] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  const [autoFailover, setAutoFailover] = useState(true);
  const [dailyLimit, setDailyLimit] = useState('10000000');
  const [notice, setNotice] = useState<string | null>(null);

  const [sweepMode, setSweepMode] = useState<'AUTO' | 'SPONSORED' | 'TREASURY_FEE_PAYER'>('AUTO');
  const [sweepSaving, setSweepSaving] = useState(false);
  const [sweepUpdatedAt, setSweepUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadSystemSettings(), loadMaintenanceConfig(), loadSweepConfig()]).then(([systemData, maintData, sweepData]) => {
      setSettings(systemData);
      setAutoFailover(systemData.autoFailoverEnabled);
      setDailyLimit(systemData.maxDailySpendLimitNGN.toString());

      if (maintData) {
        setMaintenanceEnabled(Boolean(maintData.enabled));
        if (maintData.message) setMaintenanceMessage(maintData.message);
        if (typeof maintData.estimatedMinutes === 'number') {
          setMaintenanceDuration(maintData.estimatedMinutes);
        }
        if (maintData.updatedAt) setMaintenanceUpdatedAt(maintData.updatedAt);
      }

      if (sweepData?.mode) {
        setSweepMode(sweepData.mode);
        if (sweepData.updatedAt) setSweepUpdatedAt(sweepData.updatedAt);
      }

      setLoading(false);
    });
  }, []);

  const handleSaveSweepConfig = async () => {
    setSweepSaving(true);
    try {
      const res = await updateSweepConfig(sweepMode);
      if (res) {
        setSweepMode(res.mode);
        setSweepUpdatedAt(new Date().toISOString());
        setNotice(`Sweep fee mode updated to ${res.mode}.`);
        setTimeout(() => setNotice(null), 4000);
      }
    } catch (err: any) {
      alert('Failed to update sweep mode: ' + (err?.message || err));
    } finally {
      setSweepSaving(false);
    }
  };

  const confirmToggleMaintenance = async () => {
    const nextState = !maintenanceEnabled;
    setMaintenanceSaving(true);
    try {
      const res = await updateMaintenanceConfig({
        enabled: nextState,
        message: maintenanceMessage,
        estimatedMinutes: maintenanceDuration === '' ? null : Number(maintenanceDuration),
      });

      if (res) {
        setMaintenanceEnabled(nextState);
        setMaintenanceUpdatedAt(new Date().toISOString());
        setNotice(
          `Maintenance mode has been ${
            nextState ? 'ENABLED (blocking customer actions)' : 'DISABLED (services restored)'
          }.`
        );
        setTimeout(() => setNotice(null), 5000);
      }
    } catch (err: any) {
      alert('Failed to update maintenance mode: ' + (err?.message || err));
    } finally {
      setMaintenanceSaving(false);
      setMaintenanceConfirmModal(false);
    }
  };

  const handleSaveMaintenanceConfig = async () => {
    setMaintenanceSaving(true);
    try {
      await updateMaintenanceConfig({
        enabled: maintenanceEnabled,
        message: maintenanceMessage,
        estimatedMinutes: maintenanceDuration === '' ? null : Number(maintenanceDuration),
      });
      setNotice('Maintenance parameters updated and broadcast to mobile nodes.');
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      alert('Failed to save parameters: ' + (err?.message || err));
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const handleSaveComplianceConfig = () => {
    setNotice('Compliance parameters applied and logged to regulatory SEC/CBN trail.');
    setTimeout(() => setNotice(null), 4000);
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Loading system telemetry...</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Maintenance Mode State Alert Banner */}
      {maintenanceEnabled && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-400 flex items-start gap-3.5 shadow-sm animate-fade-in">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-sm text-rose-300">Active Maintenance Mode Notice:</p>
            <p className="leading-relaxed">
              Platform Maintenance Mode is currently <strong>ACTIVE</strong>. All mobile user applications are displaying
              the System Upgrade modal blocking all new deposits, off-ramp payouts, and bill payments.
              {maintenanceUpdatedAt && (
                <span className="block mt-1 text-[11px] text-rose-300/80 font-mono">
                  Activated / Last modified: {new Date(maintenanceUpdatedAt).toLocaleString()}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

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

      {/* Operational & Maintenance Controls */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* PLATFORM MAINTENANCE MODE (Percel Pattern) */}
        <Card
          title="Platform Maintenance Mode"
          subtitle="Safeguard operations during system upgrades and contract deployments"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground block">Platform Status</span>
                  <Badge
                    variant={maintenanceEnabled ? 'destructive' : 'success'}
                    className="font-mono text-[10px] uppercase font-bold"
                  >
                    {maintenanceEnabled ? 'ACTIVE (BLOCKING)' : 'DISABLED (LIVE)'}
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground block">
                  {maintenanceEnabled
                    ? 'All user wallet apps are currently locked behind the upgrade screen.'
                    : 'All user deposit, spend, and auth systems are operational.'}
                </span>
              </div>

              <Button
                size="sm"
                variant={maintenanceEnabled ? 'primary' : 'destructive'}
                onClick={() => setMaintenanceConfirmModal(true)}
                className="text-xs h-9 gap-1.5 shrink-0"
              >
                {maintenanceEnabled ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                {maintenanceEnabled ? 'Disable Maintenance' : 'Enable Maintenance'}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  Status Message (Displayed in Mobile App)
                </label>
                <textarea
                  rows={3}
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder="e.g. Metropolis is currently undergoing scheduled maintenance. Services will resume shortly."
                  className="w-full rounded-xl border border-border/80 bg-background/80 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-silver-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Estimated Duration (Minutes)
                </label>
                <Input
                  type="number"
                  mono
                  value={maintenanceDuration}
                  onChange={(e) =>
                    setMaintenanceDuration(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))
                  }
                  placeholder="e.g. 45"
                />
                <p className="text-[11px] text-muted-foreground">
                  Shown as a countdown hint on user mobile screens. Leave empty if duration is uncertain.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveMaintenanceConfig}
                disabled={maintenanceSaving}
                className="text-xs font-semibold"
              >
                {maintenanceSaving ? 'Saving Parameters...' : 'Update Maintenance Details'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Automatic Failover & Compliance */}
        <div className="space-y-6">
          <Card title="Payment Rails & Failover" subtitle="High-availability liquidity and automatic payout failover">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3.5">
                <div>
                  <span className="text-xs font-bold text-foreground block">Automatic Provider Failover</span>
                  <span className="text-[11px] text-muted-foreground">Automatically route to Monnify if Paystack latency spikes</span>
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

              <Button variant="primary" onClick={handleSaveComplianceConfig} className="text-xs font-semibold">
                Save Compliance Parameters
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Crypto Sweep & Gas Fee Management Card */}
      <Card
        title="Crypto Sweep & Gas Fee Management"
        subtitle="Configure network fee payers and gas sponsorship for Solana & EVM deposit sweeps"
      >
        <div className="space-y-4 pt-2">
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Option 1: AUTO */}
            <div
              onClick={() => setSweepMode('AUTO')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                sweepMode === 'AUTO'
                  ? 'border-emerald-500/80 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/40'
                  : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                  <Zap className="h-4 w-4 text-emerald-400" /> Auto Fallback (Recommended)
                </span>
                {sweepMode === 'AUTO' && <Badge variant="success">Active</Badge>}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Tries Privy Gas Sponsorship first. Automatically falls back to Treasury Fee-Payer & Drip if sponsorship is disabled on Devnet/Testnet.
              </p>
            </div>

            {/* Option 2: SPONSORED */}
            <div
              onClick={() => setSweepMode('SPONSORED')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                sweepMode === 'SPONSORED'
                  ? 'border-blue-500/80 bg-blue-500/10 text-foreground ring-1 ring-blue-500/40'
                  : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                  <ShieldCheck className="h-4 w-4 text-blue-400" /> Privy Gas Relayer
                </span>
                {sweepMode === 'SPONSORED' && <Badge variant="default">Active</Badge>}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Requires Privy Gas Sponsorship policies enabled in Privy Dashboard. Deposit wallets never pay native gas fees.
              </p>
            </div>

            {/* Option 3: TREASURY_FEE_PAYER */}
            <div
              onClick={() => setSweepMode('TREASURY_FEE_PAYER')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                sweepMode === 'TREASURY_FEE_PAYER'
                  ? 'border-amber-500/80 bg-amber-500/10 text-foreground ring-1 ring-amber-500/40'
                  : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                  <Coins className="h-4 w-4 text-amber-400" /> Treasury Fee-Payer & Drip
                </span>
                {sweepMode === 'TREASURY_FEE_PAYER' && <Badge variant="warning">Active</Badge>}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Treasury Wallet pays transaction fees on Solana and drips native gas on Monad EVM. Works seamlessly on Devnet / Testnet.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <span className="text-[11px] text-muted-foreground">
              {sweepUpdatedAt ? `Last modified: ${new Date(sweepUpdatedAt).toLocaleString()}` : 'Default mode active'}
            </span>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSaveSweepConfig}
              disabled={sweepSaving}
            >
              {sweepSaving ? 'Saving...' : 'Save Sweep Mode'}
            </Button>
          </div>
        </div>
      </Card>

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

      {/* MAINTENANCE MODE CONFIRMATION MODAL (Percel High-Safety Protocol) */}
      {maintenanceConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  maintenanceEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Confirm {maintenanceEnabled ? 'Disabling' : 'Enabling'} Maintenance Mode?
                </h3>
                <p className="text-xs text-muted-foreground">
                  High-privilege platform operation safeguard
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {maintenanceEnabled
                ? 'Disabling maintenance mode will immediately restore normal access to deposits, off-ramp spends, and wallet functions across all user mobile apps.'
                : 'Enabling maintenance mode will block all new customer spend orders, crypto deposits, and bill payments platform-wide. All active mobile wallet sessions will display the System Upgrade overlay.'}
            </p>

            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-[11px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Status:</span>
                <span className="font-bold text-foreground">
                  {maintenanceEnabled ? 'DISABLED (LIVE SERVICES)' : 'ACTIVE (BLOCKING ACCESS)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Duration:</span>
                <span className="font-mono font-semibold text-foreground">
                  {maintenanceDuration ? `~${maintenanceDuration} mins` : 'Indefinite'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Message Preview:</span>
                <span className="font-medium text-foreground truncate max-w-[210px]" title={maintenanceMessage}>
                  {maintenanceMessage}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMaintenanceConfirmModal(false)}
                disabled={maintenanceSaving}
              >
                Cancel
              </Button>
              <Button
                variant={maintenanceEnabled ? 'primary' : 'destructive'}
                size="sm"
                onClick={confirmToggleMaintenance}
                disabled={maintenanceSaving}
                className="gap-1.5"
              >
                {maintenanceSaving ? (
                  'Updating...'
                ) : maintenanceEnabled ? (
                  'Restore Normal Services'
                ) : (
                  'Activate Maintenance Mode'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
