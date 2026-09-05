import React from 'react';
import { Card, Button, Input, Mono, Badge } from '@kudi/ui';

interface RateEngineCardProps {
  rateOverride: string;
  onRateChange: (val: string) => void;
  onRateSubmit: () => void;
}

export const RateEngineCard: React.FC<RateEngineCardProps> = ({ rateOverride, onRateChange, onRateSubmit }) => {
  return (
    <Card title="Live Exchange Rate Engine">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '16px' }}>
        <Mono size="xl" style={{ fontWeight: 800, color: '#34D399' }}>
          ₦{rateOverride}
        </Mono>
        <span style={{ fontSize: '14px', color: 'var(--text-mut, #9ca3af)', fontFamily: "'Share Tech Mono', monospace" }}>
          / USDC
        </span>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ width: '140px' }}>
          <Input
            type="number"
            value={rateOverride}
            onChange={(e) => onRateChange(e.target.value)}
            mono
          />
        </div>
        <Button variant="primary" size="md" onClick={onRateSubmit}>
          Override Rate
        </Button>
      </div>
      <div style={{ marginTop: '12px' }}>
        <Badge variant="silver">Source: Binance & Bybit P2P · Spread Margin: 0.9%</Badge>
      </div>
    </Card>
  );
};
