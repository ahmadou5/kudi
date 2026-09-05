'use client';

import React from 'react';
import { Card, Mono, Badge } from '@kudi/ui';
import { RateEngineCard } from '../components/RateEngineCard';
import { ProviderManagerCard } from '../components/ProviderManagerCard';
import { ChainConfigCard } from '../components/ChainConfigCard';
import { ReconciliationCard } from '../components/ReconciliationCard';
import { useAdminDashboard } from '../hooks/useAdminDashboard';

export default function AdminDashboard() {
  const {
    activeProvider,
    rateOverride,
    setRateOverride,
    evmChains,
    handleProviderSwitch,
    handleRateOverrideSubmit,
    toggleEvmChain
  } = useAdminDashboard();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <RateEngineCard
          rateOverride={rateOverride}
          onRateChange={setRateOverride}
          onRateSubmit={handleRateOverrideSubmit}
        />

        <Card title="Active Payout Rail">
          <div style={{ marginBottom: '12px' }}>
            <Mono size="xl" style={{ fontWeight: 800, textTransform: 'uppercase' }}>
              {activeProvider}
            </Mono>
          </div>
          <Badge variant="silver">
            Failover Order: Paystack → Monnify → Squad
          </Badge>
        </Card>

        <Card title="Supported Custody Chains">
          <div style={{ marginBottom: '12px' }}>
            <Mono size="xl" style={{ fontWeight: 800 }}>
              Solana + Monad
            </Mono>
          </div>
          <Badge variant="success">
            Config-driven EVM Listener active
          </Badge>
        </Card>
      </div>

      <ProviderManagerCard activeProvider={activeProvider} onProviderSwitch={handleProviderSwitch} />
      <ChainConfigCard chains={evmChains} onToggleChain={toggleEvmChain} />
      <ReconciliationCard />
    </div>
  );
}
