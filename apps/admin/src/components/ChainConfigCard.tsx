import React, { useState } from 'react';
import { Card, Badge, Mono } from '@kudi/ui';
import { Copy, Check } from 'lucide-react';

export interface ChainConfigItem {
  id: string;
  name: string;
  token: string;
  enabled: boolean;
  rpcUrl: string;
  treasuryAddress?: string;
}

interface ChainConfigCardProps {
  chains: ChainConfigItem[];
  onToggleChain: (id: string) => void;
}

export const ChainConfigCard: React.FC<ChainConfigCardProps> = ({ chains, onToggleChain }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (address: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(address);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

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
              {chain.treasuryAddress && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-mut, #9ca3af)' }}>Treasury Fee-Payer:</span>
                  <Mono size="sm" style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', color: '#6366f1' }}>
                    {chain.treasuryAddress}
                  </Mono>
                  <button
                    onClick={() => handleCopy(chain.treasuryAddress!, chain.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: copiedId === chain.id ? '#34d399' : '#9ca3af',
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px'
                    }}
                    title="Copy Treasury Address"
                  >
                    {copiedId === chain.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}
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
