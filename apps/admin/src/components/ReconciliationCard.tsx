import React from 'react';
import { Card, Button, Mono } from '@kudi/ui';

export const ReconciliationCard: React.FC = () => {
  return (
    <Card title="Reconciliation & SEC/CBN Compliance Audit">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: 'var(--card-bg, rgba(255,255,255,0.03))', padding: '16px', borderRadius: '14px', border: '1px solid var(--card-border, rgba(255,255,255,0.08))' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-mut, #9ca3af)', marginBottom: '6px' }}>Total Crypto Received (Solana + Monad)</div>
          <Mono size="lg" style={{ fontWeight: 700 }}>$1,250.00 USDC / AUSD</Mono>
        </div>
        <div style={{ background: 'var(--card-bg, rgba(255,255,255,0.03))', padding: '16px', borderRadius: '14px', border: '1px solid var(--card-border, rgba(255,255,255,0.08))' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-mut, #9ca3af)', marginBottom: '6px' }}>Total NGN Disbursed to Nigerian Banks</div>
          <Mono size="lg" style={{ fontWeight: 700, color: '#34D399' }}>₦1,981,875.00 NGN</Mono>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <a
          href="http://localhost:4000/api/admin/reconciliation/export-csv"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <Button variant="primary" size="md">
            📥 Export Compliance Audit CSV
          </Button>
        </a>
      </div>
    </Card>
  );
};
