import React from 'react';
import { Card, Badge, Mono } from '@kudi/ui';

export interface ChainConfigItem {
  id: string;
  name: string;
  token: string;
  enabled: boolean;
  rpcUrl: string;
}

interface ChainConfigCardProps {
  chains: ChainConfigItem[];
  onToggleChain: (id: string) => void;
}

export const ChainConfigCard: React.FC<ChainConfigCardProps> = ({ chains, onToggleChain }) => {
  return (
    <Card title="EVM Chain & Token Configuration">
      <p style={{ color: 'var(--text-mut, #9ca3af)', fontSize: '14px', marginBottom: '16px' }}>
        Enable or add new EVM deposit chains at runtime. Generalized EVM worker picks up new contracts automatically.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {chains.map((chain) => (
          <div
            key={chain.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              background: 'var(--card-bg, rgba(255,255,255,0.03))',
              borderRadius: '14px',
              border: '1px solid var(--card-border, rgba(255,255,255,0.08))'
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{chain.name}</div>
              <Mono size="sm" style={{ color: 'var(--text-mut, #9ca3af)' }}>
                Token: {chain.token} · RPC: {chain.rpcUrl}
              </Mono>
            </div>
            <button
              onClick={() => onToggleChain(chain.id)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Badge variant={chain.enabled ? 'success' : 'error'}>
                {chain.enabled ? 'ENABLED' : 'DISABLED'}
              </Badge>
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
};
