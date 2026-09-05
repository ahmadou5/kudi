import React from 'react';
import { Card, Badge } from '@kudi/ui';
import { PaymentProviderId } from '@kudi/types';

interface ProviderManagerCardProps {
  activeProvider: PaymentProviderId;
  onProviderSwitch: (id: PaymentProviderId) => void;
}

export const ProviderManagerCard: React.FC<ProviderManagerCardProps> = ({ activeProvider, onProviderSwitch }) => {
  const providers = [
    { id: PaymentProviderId.PAYSTACK, name: 'Paystack Transfers API' },
    { id: PaymentProviderId.MONNIFY, name: 'Monnify Direct Payout' },
    { id: PaymentProviderId.SQUAD, name: 'Squad GTCO Payout' }
  ];

  return (
    <Card title="Payment Provider Management (Multi-Provider NGN Payout)">
      <p style={{ color: 'var(--text-mut, #9ca3af)', fontSize: '14px', marginBottom: '20px' }}>
        Select the active NGN payout provider. Transfers route dynamically with automatic multi-provider failover.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {providers.map((provider) => {
          const isActive = activeProvider === provider.id;
          return (
            <button
              key={provider.id}
              onClick={() => onProviderSwitch(provider.id)}
              style={{
                padding: '20px',
                borderRadius: '16px',
                border: isActive
                  ? '2px solid var(--text-main, #FFFFFF)'
                  : '1px solid var(--card-border, rgba(255,255,255,0.12))',
                background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'var(--card-bg, rgba(255,255,255,0.02))',
                color: 'var(--text-main, #fff)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>{provider.name}</div>
              <div>
                {isActive ? (
                  <Badge variant="success">● ACTIVE PROVIDER</Badge>
                ) : (
                  <Badge variant="default">Click to activate</Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
};
