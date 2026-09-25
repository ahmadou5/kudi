'use client';

import React, { useState, useEffect } from 'react';
import {
  loadSystemSettings,
  loadMaintenanceConfig,
  updateMaintenanceConfig,
  loadSweepConfig,
  updateSweepConfig,
  loadDrips,
  loadTreasury,
  loadSweepHealth,
  AdminSettings,
  AdminSweepConfig,
  DripLedger,
  TreasurySnapshot,
  SweepHealth
} from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import {
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
  ShieldCheck,
  Building2,
  Copy,
  Check,
  ExternalLink,
  Lock
} from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Maintenance state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "We're currently upgrading Metropolis to bring you improved performance and security. Services will resume shortly."
  );
  const [maintenanceDuration, setMaintenanceDuration] = useState<number | ''>(30);
  const [maintenanceUpdatedAt, setMaintenanceUpdatedAt] = useState<string | null>(null);
  const [maintenanceConfirmModal, setMaintenanceConfirmModal] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  // Operational states
  const [autoFailover, setAutoFailover] = useState(true);
  const [dailyLimit, setDailyLimit] = useState('10000000');
  const [notice, setNotice] = useState<string | null>(null);

  // Sweep state (TREASURY_FEE_PAYER is not an admin-selectable sweep mode:
  // the backend sendCrypto path throws in that mode, so offering it would DoS
  // sweeps — only AUTO / SPONSORED are selectable here).
  const [sweepMode, setSweepMode] = useState<'AUTO' | 'SPONSORED'>('AUTO');
  const [storedSweepModeRaw, setStoredSweepModeRaw] = useState<string | null>(null);
  const [gasPaymentMode, setGasPaymentMode] = useState<'PRIVY_SPONSOR' | 'TREASURY_FEE_PAYER'>('PRIVY_SPONSOR');
  const [effectiveMode, setEffectiveMode] = useState<string | null>(null);
  const [sweepReceipt, setSweepReceipt] = useState<AdminSweepConfig['receipt']>(null);
  const [sweepAuditId, setSweepAuditId] = useState<string | null>(null);
  const [sweepError, setSweepError] = useState<string | null>(null);
  const [sweepSaving, setSweepSaving] = useState(false);
  const [sweepUpdatedAt, setSweepUpdatedAt] = useState<string | null>(null);

  // Treasury runway + drip ledger + sweep health
  const [treasury, setTreasury] = useState<TreasurySnapshot | null>(null);
  const [dripLedger, setDripLedger] = useState<DripLedger | null>(null);
  const [sweepHealth, setSweepHealth] = useState<SweepHealth | null>(null);

  // Confirmation Modals State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    variant?: 'primary' | 'destructive' | 'warning';
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  function copyToClipboard(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  }

  useEffect(() => {
    Promise.all([loadSystemSettings(), loadMaintenanceConfig(), loadSweepConfig(), loadTreasury(), loadDrips(), loadSweepHealth()]).then(
      ([systemData, maintData, sweepData, treasuryData, dripsData, healthData]) => {
        setSettings(systemData);
        setAutoFailover(systemData.autoFailoverEnabled);
        setDailyLimit(systemData.maxDailySpendLimitNGN.toString());
        setTreasury(treasuryData);
        setDripLedger(dripsData);
        setSweepHealth(healthData);

        if (maintData) {
          setMaintenanceEnabled(Boolean(maintData.enabled));
          if (maintData.message) setMaintenanceMessage(maintData.message);
          if (typeof maintData.estimatedMinutes === 'number') {
            setMaintenanceDuration(maintData.estimatedMinutes);
          }
          if (maintData.updatedAt) setMaintenanceUpdatedAt(maintData.updatedAt);
        }

        if (sweepData) {
          setStoredSweepModeRaw(sweepData.mode || null);
          if (sweepData.mode === 'AUTO' || sweepData.mode === 'SPONSORED') {
            setSweepMode(sweepData.mode);
          }
          if (sweepData.gasPaymentMode === 'PRIVY_SPONSOR' || sweepData.gasPaymentMode === 'TREASURY_FEE_PAYER') {
            setGasPaymentMode(sweepData.gasPaymentMode);
          }
          if (sweepData.effectiveMode) setEffectiveMode(sweepData.effectiveMode);
          if (sweepData.receipt) {
            setSweepReceipt(sweepData.receipt);
            if (sweepData.auditId) setSweepAuditId(sweepData.auditId);
          }
          if (sweepData.updatedAt) setSweepUpdatedAt(sweepData.updatedAt);
        }

        setLoading(false);
      }
    );
  }, []);

  const requestSweepConfigSave = () => {
    setConfirmModalConfig({
      isOpen: true,
      title: `Update Sweep Gas Policy to ${sweepMode} / ${gasPaymentMode}`,
      description: `Are you sure you want to switch the sweep policy to mode ${sweepMode} with gas payment ${gasPaymentMode}? This affects how gas sponsorship and fee payment handle on-chain sweeps for Solana and Monad deposit wallets.`,
      variant: 'warning',
      onConfirm: async () => {
        setSweepSaving(true);
        setSweepError(null);
        try {
          const res = await updateSweepConfig(sweepMode, gasPaymentMode);
          if (res) {
            if (res.mode === 'AUTO' || res.mode === 'SPONSORED') setSweepMode(res.mode);
            if (res.gasPaymentMode === 'PRIVY_SPONSOR' || res.gasPaymentMode === 'TREASURY_FEE_PAYER') {
              setGasPaymentMode(res.gasPaymentMode);
            }
            if (res.effectiveMode) setEffectiveMode(res.effectiveMode);
            setSweepReceipt(res.receipt || null);
            setSweepAuditId(res.auditId || null);
            setSweepUpdatedAt(res.updatedAt || new Date().toISOString());
            setNotice(`Sweep gas policy updated: ${res.mode} / ${res.gasPaymentMode} (effective ${res.effectiveMode}).`);
            setTimeout(() => setNotice(null), 4000);
          }
        } catch (err: any) {
          setSweepError(err?.message || String(err));
        } finally {
          setSweepSaving(false);
          setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const confirmToggleMaintenance = async () => {
    const nextState = !maintenanceEnabled;
    setMaintenanceSaving(true);
    try {
      const res = await updateMaintenanceConfig({
        enabled: nextState,
        message: maintenanceMessage,
        estimatedMinutes: maintenanceDuration === '' ? null : Number(maintenanceDuration)
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

  const requestSaveCompliance = () => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Update CBN Tier 2 Compliance Limits',
      description: `Are you sure you want to set the Tier 2 Max Daily Spend Limit to ₦${parseInt(dailyLimit || '0', 10).toLocaleString('en-NG')}?`,
      variant: 'primary',
      onConfirm: () => {
        setNotice('Compliance parameters applied and logged to regulatory SEC/CBN trail.');
        setTimeout(() => setNotice(null), 4000);
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const requestToggleFailover = () => {
    const nextState = !autoFailover;
    setConfirmModalConfig({
      isOpen: true,
      title: `${nextState ? 'Enable' : 'Disable'} Automatic Provider Failover`,
      description: `Are you sure you want to ${nextState ? 'enable' : 'disable'} automatic provider failover? ${
        nextState
          ? 'Payouts will automatically fail over to fallback rails (Monnify/Squad) if Paystack latency degrades.'
          : 'Failover is disabled; failed transactions will require manual operator action.'
      }`,
      variant: nextState ? 'primary' : 'warning',
      onConfirm: () => {
        setAutoFailover(nextState);
        setNotice(`Automatic failover has been ${nextState ? 'ENABLED' : 'DISABLED'}.`);
        setTimeout(() => setNotice(null), 4000);
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Loading system telemetry...</div>;
  }

  const solanaTreasury =
    settings.treasuryAddresses?.solana ||
    process.env.NEXT_PUBLIC_KUDI_TREASURY_SOLANA_ADDRESS ||
    null;

  const monadTreasury =
    settings.treasuryAddresses?.monad ||
    process.env.NEXT_PUBLIC_KUDI_TREASURY_EVM_ADDRESS ||
    null;

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

      {/* Central Treasury Vault Addresses */}
      <Card
        title="Central Treasury Vault Addresses"
        subtitle="On-chain destinations for customer deposit sweeps and liquidity backing"
      >
        <div className="grid gap-4 md:grid-cols-2 pt-2">
          {/* Solana Treasury */}
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-xs text-foreground">Solana Central Treasury</span>
              </div>
              <Badge variant="silver" className="text-[10px] font-mono">
                Solana Devnet / Mainnet
              </Badge>
            </div>
            <div className="rounded-lg border border-border/60 bg-black/60 p-3 flex items-center justify-between gap-2">
              {solanaTreasury ? (
                <>
                  <span className="font-mono text-xs text-emerald-300 truncate select-all">{solanaTreasury}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => copyToClipboard(solanaTreasury, 'solanaTreasury')}
                      className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Copy Solana Treasury Address"
                    >
                      {copiedField === 'solanaTreasury' ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <a
                      href={`https://explorer.solana.com/address/${solanaTreasury}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </>
              ) : (
                <span className="text-xs text-amber-400 italic flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> KUDI_TREASURY_SOLANA_ADDRESS not set in environment
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              All user SPL USDC deposits are swept directly to this Treasury account to back off-ramp liquidity.
            </p>
          </div>

          {/* Monad EVM Treasury */}
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-400" />
                <span className="font-bold text-xs text-foreground">Monad EVM Central Treasury</span>
              </div>
              <Badge variant="silver" className="text-[10px] font-mono">
                Monad Metropolis Testnet
              </Badge>
            </div>
            <div className="rounded-lg border border-border/60 bg-black/60 p-3 flex items-center justify-between gap-2">
              {monadTreasury ? (
                <>
                  <span className="font-mono text-xs text-purple-300 truncate select-all">{monadTreasury}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => copyToClipboard(monadTreasury, 'monadTreasury')}
                      className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Copy Monad Treasury Address"
                    >
                      {copiedField === 'monadTreasury' ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <a
                      href={`https://testnet.monadexplorer.com/address/${monadTreasury}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </>
              ) : (
                <span className="text-xs text-amber-400 italic flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> KUDI_TREASURY_EVM_ADDRESS not set in environment
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              All Monad Testnet AUSD/USDC deposits are swept directly to this EVM Treasury address.
            </p>
          </div>
        </div>
      </Card>

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
        {/* PLATFORM MAINTENANCE MODE */}
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
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConfirmModalConfig({
                    isOpen: true,
                    title: 'Update Maintenance Parameters',
                    description: 'Are you sure you want to update the maintenance status message and estimated duration displayed on user mobile screens?',
                    variant: 'primary',
                    onConfirm: () => {
                      setNotice('Maintenance parameters updated and broadcast to mobile nodes.');
                      setTimeout(() => setNotice(null), 4000);
                      setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                    }
                  });
                }}
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
                  onClick={requestToggleFailover}
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

              <Button variant="primary" onClick={requestSaveCompliance} className="text-xs font-semibold">
                Save Compliance Parameters
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Treasury & Gas Runway */}
      <Card
        title="Treasury & Gas Runway"
        subtitle="Native gas + stablecoin float per chain, configured drip policy, and remaining drip runway"
      >
        {!treasury ? (
          <p className="text-xs text-muted-foreground pt-2">Loading treasury snapshot...</p>
        ) : treasury.chains.length === 0 ? (
          <p className="text-xs text-amber-400 pt-2">
            Treasury snapshot unavailable{treasury.error ? `: ${treasury.error}` : ' — check RPC connectivity and treasury env.'}
          </p>
        ) : (
          <div className="space-y-4 pt-2">
            {treasury.chains.some((c) => c.lowRunway) && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Low gas runway: {treasury.chains.filter((c) => c.lowRunway).map((c) => `${c.nativeSymbol} (${c.chain})`).join(', ')} native balance is below 2x the configured drip amount. Fund the treasury before sweeps start failing.
                </span>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {treasury.chains.map((c) => {
                const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const weekDrips = (dripLedger?.drips || []).filter(
                  (d) => d.chain === c.chain && new Date(d.time).getTime() >= weekAgo
                ).length;
                const dripsPerDay = weekDrips / 7;
                const daysAtTrailingRate =
                  c.dripsRemaining !== null && dripsPerDay > 0 ? c.dripsRemaining / dripsPerDay : null;
                return (
                  <div key={c.chain} className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground capitalize">
                        {c.chain} Treasury
                      </span>
                      {c.lowRunway ? (
                        <Badge variant="warning" className="text-[10px]">LOW RUNWAY</Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px]">HEALTHY</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-border/60 bg-black/40 p-2.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Native {c.nativeSymbol}</span>
                        <span className="font-mono font-bold text-foreground">
                          {c.nativeBalance !== null ? `${c.nativeBalance.toFixed(4)} ${c.nativeSymbol}` : 'unknown'}
                        </span>
                        {c.nativeError && <span className="block text-[10px] text-amber-400 truncate" title={c.nativeError}>RPC error</span>}
                      </div>
                      <div className="rounded-lg border border-border/60 bg-black/40 p-2.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">{c.floatToken} Float</span>
                        <span className="font-mono font-bold text-emerald-300">
                          {c.floatBalance !== null ? `${c.floatBalance.toFixed(2)} ${c.floatToken}` : 'unknown'}
                        </span>
                        {c.floatError && <span className="block text-[10px] text-amber-400 truncate" title={c.floatError}>RPC error</span>}
                      </div>
                      <div className="rounded-lg border border-border/60 bg-black/40 p-2.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Drip Policy</span>
                        <span className="font-mono text-foreground">{c.dripAmount} {c.nativeSymbol} / drip</span>
                        <span className="block font-mono text-[10px] text-muted-foreground">threshold {c.dripThreshold}</span>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-black/40 p-2.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Runway</span>
                        <span className="font-mono font-bold text-foreground">
                          {c.dripsRemaining !== null ? `${c.dripsRemaining} drips` : 'unknown'}
                        </span>
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          {daysAtTrailingRate !== null
                            ? `~${daysAtTrailingRate.toFixed(1)} days at 7d trailing rate (${dripsPerDay.toFixed(2)}/day)`
                            : weekDrips === 0
                              ? 'no drips in trailing 7d'
                              : 'trailing rate unavailable'}
                        </span>
                      </div>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground truncate" title={c.treasuryAddress || 'not set'}>
                      {c.treasuryAddress || 'treasury address not set'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Sweep Health (server-computed) */}
      <Card
        title="Sweep Health"
        subtitle="Server-computed sweep summary, stale worker claims, and exhausted retries"
      >
        {!sweepHealth ? (
          <p className="text-xs text-muted-foreground pt-2">
            Sweep health endpoint unavailable — showing nothing rather than a client-side estimate. Check API connectivity.
          </p>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Pending', value: sweepHealth.summary.pendingUSDC, tone: 'text-amber-300' },
                { label: 'Processing', value: sweepHealth.summary.processingUSDC, tone: 'text-foreground' },
                { label: 'Swept', value: sweepHealth.summary.sweptUSDC, tone: 'text-emerald-400' },
                { label: 'Failed', value: sweepHealth.summary.failedUSDC, tone: 'text-rose-400' },
                { label: 'Blocked', value: sweepHealth.summary.blockedUSDC, tone: 'text-rose-300' },
                { label: 'Float Exposure', value: sweepHealth.summary.floatExposureUSDC, tone: 'text-sky-300' }
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-border/60 bg-muted/30 p-3 text-right">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">{kpi.label}</span>
                  <span className={`font-mono text-sm font-bold ${kpi.tone}`}>${kpi.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge variant="silver" className="font-mono">
                {sweepHealth.summary.totalDeposits} deposits tracked
              </Badge>
              {sweepHealth.summary.exhaustedCount > 0 ? (
                <Badge variant="warning" className="font-mono">
                  {sweepHealth.summary.exhaustedCount} exhausted (≥4 attempts)
                </Badge>
              ) : (
                <Badge variant="success" className="font-mono">0 exhausted</Badge>
              )}
              {sweepHealth.staleProcessing.length > 0 && (
                <Badge variant="warning" className="font-mono">
                  {sweepHealth.staleProcessing.length} stale SWEEP_PROCESSING (&gt;10 min)
                </Badge>
              )}
              {sweepHealth.accessibility.filter((a) => a.accessMode !== 'SERVER_CUSTODY').length > 0 && (
                <Badge variant="outline" className="font-mono">
                  non-server-custody exposure present (see deposits)
                </Badge>
              )}
            </div>
            {sweepHealth.exhausted.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/70 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="pb-2 pt-1">Signature</th>
                      <th className="pb-2 pt-1">Chain</th>
                      <th className="pb-2 pt-1 text-right">Amount</th>
                      <th className="pb-2 pt-1 text-center">Status</th>
                      <th className="pb-2 pt-1 text-center">Attempts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {sweepHealth.exhausted.slice(0, 10).map((row) => (
                      <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2 font-mono text-[11px] text-foreground">
                          {row.signature.length > 24 ? `${row.signature.slice(0, 12)}...${row.signature.slice(-8)}` : row.signature}
                        </td>
                        <td className="py-2 text-muted-foreground capitalize">{row.chain}</td>
                        <td className="py-2 text-right font-mono text-foreground">${row.amountUSDC.toFixed(2)}</td>
                        <td className="py-2 text-center">
                          <Badge variant="warning" className="text-[10px]">{row.sweepStatus}</Badge>
                        </td>
                        <td className="py-2 text-center font-mono text-muted-foreground">{row.sweepAttemptCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Crypto Sweep & Gas Policy Management Card */}
      <Card
        title="Crypto Sweep & Gas Policy Management"
        subtitle="Configure sweep mode and gas payment, with the backend-resolved effective mode"
      >
        <div className="space-y-4 pt-2">
          {storedSweepModeRaw && storedSweepModeRaw !== 'AUTO' && storedSweepModeRaw !== 'SPONSORED' && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Stored sweep mode <span className="font-mono font-bold">{storedSweepModeRaw}</span> is no longer
                admin-selectable (it throws inside the sweep path). Save a new policy below to migrate away from it.
              </span>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
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
                Tries Privy Gas Sponsorship first. Automatically falls back to treasury drip where the backend supports it.
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
          </div>

          {/* Gas payment mode selector */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-amber-400" /> Gas Payment Mode (stored knob, strictly validated)
            </span>
            <div className="flex flex-wrap gap-2">
              {(['PRIVY_SPONSOR', 'TREASURY_FEE_PAYER'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setGasPaymentMode(mode)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer ${
                    gasPaymentMode === mode
                      ? 'bg-foreground text-background shadow-xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Resolved effective mode: <span className="font-mono font-bold text-foreground">{effectiveMode || '—'}</span>
              <span className="block">The backend resolves the effective mode from the stored value (DB wins, validated union) — what you see here is what sweeps use.</span>
            </p>
          </div>

          {sweepError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Failed to save sweep policy: {sweepError}</span>
            </div>
          )}

          {/* After-save inline receipt (not just a toast) */}
          {sweepReceipt && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                <CheckCircle2 className="h-4 w-4" />
                <span>Sweep policy change receipt</span>
              </div>
              <div className="grid gap-1 text-[11px] font-mono text-muted-foreground">
                <span>changed by: <span className="text-foreground">{sweepReceipt.changedBy}</span></span>
                <span>changed at: <span className="text-foreground">{new Date(sweepReceipt.changedAt).toLocaleString()}</span></span>
                <span>
                  previous: <span className="text-foreground">{sweepReceipt.previous.mode} / {sweepReceipt.previous.gasPaymentMode}</span>
                  {' → '}
                  new: <span className="text-foreground">{sweepReceipt.new.mode} / {sweepReceipt.new.gasPaymentMode}</span>
                  {' '}effective: <span className="text-foreground">{sweepReceipt.new.effectiveMode}</span>
                </span>
                {sweepAuditId && <span>audit id: <span className="text-foreground">{sweepAuditId}</span></span>}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <span className="text-[11px] text-muted-foreground">
              {sweepUpdatedAt ? `Last modified: ${new Date(sweepUpdatedAt).toLocaleString()}` : 'Default mode active'}
              {sweepAuditId ? ` · audit ${sweepAuditId.slice(0, 8)}` : ''}
            </span>
            <Button
              size="sm"
              variant="primary"
              onClick={requestSweepConfigSave}
              disabled={sweepSaving}
            >
              {sweepSaving ? 'Saving...' : 'Save Sweep Policy'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Drip Ledger */}
      <Card
        title="Treasury Drip Ledger"
        subtitle="Native gas drips paid by the treasury to unblock sweeps (newest first, 24h totals)"
      >
        {!dripLedger ? (
          <p className="text-xs text-muted-foreground pt-2">Loading drip ledger...</p>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge variant="silver" className="font-mono">24h: {dripLedger.totals.last24h.count} drips</Badge>
              <Badge variant="success" className="font-mono">{dripLedger.totals.last24h.confirmed} confirmed</Badge>
              <Badge variant="warning" className="font-mono">{dripLedger.totals.last24h.failed} timed out</Badge>
              <Badge variant="silver" className="font-mono">{dripLedger.totals.last24h.pending} broadcast</Badge>
              <Badge variant="outline" className="font-mono">
                24h spent: {dripLedger.totals.spentNativePerChain24h.solana.toFixed(4)} SOL · {dripLedger.totals.spentNativePerChain24h.monad.toFixed(4)} MON
              </Badge>
            </div>
            {dripLedger.drips.length === 0 ? (
              <p className="text-xs text-muted-foreground">No drips recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/70 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="pb-2 pt-1">Time</th>
                      <th className="pb-2 pt-1">Chain</th>
                      <th className="pb-2 pt-1">Wallet</th>
                      <th className="pb-2 pt-1 text-right">Amount</th>
                      <th className="pb-2 pt-1">Tx</th>
                      <th className="pb-2 pt-1">Trigger</th>
                      <th className="pb-2 pt-1 text-center">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {dripLedger.drips.slice(0, 50).map((drip) => (
                      <tr key={drip.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {new Date(drip.time).toLocaleString()}
                        </td>
                        <td className="py-2 text-foreground font-semibold capitalize">{drip.chain}</td>
                        <td className="py-2 font-mono text-[11px] text-foreground" title={drip.walletAddress}>
                          {drip.walletAddress.length > 16
                            ? `${drip.walletAddress.slice(0, 6)}...${drip.walletAddress.slice(-4)}`
                            : drip.walletAddress}
                        </td>
                        <td className="py-2 text-right font-mono text-foreground">
                          {drip.amountNative.toFixed(4)} {drip.chain === 'solana' ? 'SOL' : 'MON'}
                        </td>
                        <td className="py-2">
                          <a
                            href={drip.chain === 'solana'
                              ? `https://explorer.solana.com/tx/${drip.txHash}?cluster=devnet`
                              : `https://testnet.monadexplorer.com/tx/${drip.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11px] text-sky-300 hover:text-sky-200 inline-flex items-center gap-1"
                          >
                            {drip.txHash.slice(0, 8)}...{drip.txHash.slice(-6)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                        <td className="py-2 font-mono text-[11px] text-muted-foreground">{drip.trigger}</td>
                        <td className="py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Badge
                              variant={drip.status === 'CONFIRMED' ? 'success' : drip.status === 'TIMEOUT' ? 'warning' : 'silver'}
                              className="text-[10px] font-mono"
                            >
                              {drip.status}
                            </Badge>
                            {drip.cause && (
                              <Badge variant="outline" className="text-[10px] font-mono" title="Server-classified failure cause">
                                {drip.cause}
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
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

      {/* Confirmation Modal for Maintenance Mode Toggle */}
      <ConfirmActionModal
        isOpen={maintenanceConfirmModal}
        title={`${maintenanceEnabled ? 'Disable' : 'Enable'} Platform Maintenance Mode`}
        description={
          maintenanceEnabled
            ? 'Are you sure you want to disable maintenance mode? This will restore user access across all mobile wallet applications.'
            : 'Are you sure you want to enable maintenance mode? This will display the System Upgrade screen on all mobile user applications, blocking deposits, off-ramping, and bill payments.'
        }
        variant={maintenanceEnabled ? 'primary' : 'destructive'}
        confirmText={maintenanceEnabled ? 'Restore Live Services' : 'Activate Maintenance Mode'}
        isLoading={maintenanceSaving}
        onConfirm={confirmToggleMaintenance}
        onCancel={() => setMaintenanceConfirmModal(false)}
      />

      {/* General Confirmation Modal for Other Settings Actions */}
      <ConfirmActionModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        description={confirmModalConfig.description}
        variant={confirmModalConfig.variant}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
