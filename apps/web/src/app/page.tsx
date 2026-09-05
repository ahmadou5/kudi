'use client';

import React, { useState } from 'react';
import { Card, Button, Badge, ThemeToggle, Heading, Mono, ThemeMode } from '@kudi/ui';

export default function LandingPage() {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [usdcAmount, setUsdcAmount] = useState<string>('100');
  const [rateNGN] = useState<number>(1585);

  const calculateNGN = (): string => {
    const parsed = parseFloat(usdcAmount) || 0;
    const ngn = parsed * rateNGN;
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(ngn);
  };

  const isLight = mode === 'light';

  return (
    <div
      data-theme={mode}
      style={{
        minHeight: '100vh',
        background: isLight
          ? 'radial-gradient(ellipse at top, #F1F5F9 0%, #FFFFFF 60%)'
          : 'radial-gradient(ellipse at top, #1A1D26 0%, #090A0F 60%)',
        color: isLight ? '#0F172A' : '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background 0.3s ease, color 0.3s ease'
      }}
    >
      {/* Header */}
      <header
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: isLight
                ? 'linear-gradient(135deg, #0F172A 0%, #475569 100%)'
                : 'linear-gradient(135deg, #F8FAFC 0%, #94A3B8 100%)',
              color: isLight ? '#FFFFFF' : '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Smooch Sans', sans-serif",
              fontWeight: 900,
              fontSize: '28px',
              boxShadow: isLight
                ? '0 4px 14px rgba(15,23,42,0.2)'
                : '0 4px 20px rgba(248,250,252,0.25)'
            }}
          >
            K
          </div>
          <div>
            <span
              style={{
                fontFamily: "'Smooch Sans', sans-serif",
                fontSize: '32px',
                fontWeight: 900,
                letterSpacing: '0.5px'
              }}
            >
              Kudi
            </span>
            <Badge variant="silver" mode={mode} style={{ marginLeft: '8px', verticalAlign: 'middle' }}>
              Monad Metropolis
            </Badge>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <ThemeToggle mode={mode} onToggle={setMode} />
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <Button variant="outline" mode={mode}>
              Admin Ops Console →
            </Button>
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main
        style={{
          flex: 1,
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '60px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        <Badge variant="mono" mode={mode} style={{ marginBottom: '20px', padding: '6px 14px' }}>
          ⚡ TRACK A: CUSTODY ABSTRACTION & INSTANT BANK PAYOUT
        </Badge>

        <Heading level={1} mode={mode} style={{ marginBottom: '20px', maxWidth: '850px' }}>
          Deposit Stablecoins. Spend Instant Naira to Any Bank.
        </Heading>

        <p
          style={{
            fontSize: '18px',
            color: isLight ? '#475569' : '#94A3B8',
            maxWidth: '680px',
            lineHeight: 1.6,
            marginBottom: '40px'
          }}
        >
          Kudi provides zero-friction liquidity for crypto holders in Nigeria. Deposit Solana USDC or Monad Metropolis AUSD, keep your balance in float, and spend directly to any NGN bank account at live P2P exchange rates.
        </p>

        {/* Live Interactive Conversion Preview */}
        <Card
          mode={mode}
          style={{
            maxWidth: '520px',
            width: '100%',
            marginBottom: '60px',
            textAlign: 'left'
          }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span>Instant Spend Calculator</span>
              <Badge variant="success" mode={mode}>Live Rate ₦{rateNGN} / USDC</Badge>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: isLight ? '#475569' : '#94A3B8',
                  display: 'block',
                  marginBottom: '6px'
                }}
              >
                YOU DEPOSIT / SPEND (USDC FLOAT)
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
                  borderRadius: '14px',
                  padding: '8px 16px',
                  border: `1px solid ${isLight ? '#CBD5E1' : 'rgba(255,255,255,0.12)'}`
                }}
              >
                <input
                  type="number"
                  value={usdcAmount}
                  onChange={(e) => setUsdcAmount(e.target.value)}
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '24px',
                    fontWeight: 700,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: isLight ? '#0F172A' : '#FFFFFF',
                    width: '100%'
                  }}
                />
                <span className="font-mono" style={{ fontSize: '14px', fontWeight: 700, color: isLight ? '#64748B' : '#CBD5E1' }}>
                  USDC
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'center', color: isLight ? '#64748B' : '#94A3B8', fontSize: '18px' }}>
              ↓
            </div>

            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: isLight ? '#475569' : '#94A3B8',
                  display: 'block',
                  marginBottom: '6px'
                }}
              >
                RECIPIENT RECEIVES IN BANK ACCOUNT
              </label>
              <div
                style={{
                  background: isLight ? '#0F172A' : 'rgba(255,255,255,0.08)',
                  color: isLight ? '#FFFFFF' : '#34D399',
                  borderRadius: '14px',
                  padding: '16px',
                  textAlign: 'center'
                }}
              >
                <Mono mode={mode} size="xl" style={{ color: isLight ? '#FFFFFF' : '#34D399', fontWeight: 700 }}>
                  {calculateNGN()}
                </Mono>
              </div>
            </div>

            <Button variant="primary" mode={mode} size="lg" style={{ marginTop: '8px' }}>
              Test Spend API Endpoint →
            </Button>
          </div>
        </Card>

        {/* Feature Highlights Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            width: '100%',
            textAlign: 'left'
          }}
        >
          <Card mode={mode} title="Multi-Chain Custody Abstraction">
            <p style={{ fontSize: '14px', color: isLight ? '#475569' : '#94A3B8', lineHeight: 1.6 }}>
              Supports Solana USDC & Monad Metropolis AUSD (Agora Cross-Border leg). Built with a clean `CustodyProvider` abstraction separating self-custody (Track A Privy) from custodial partners (Track B Busha/Quidax).
            </p>
          </Card>

          <Card mode={mode} title="Multi-Rail Failover Payout Engine">
            <p style={{ fontSize: '14px', color: isLight ? '#475569' : '#94A3B8', lineHeight: 1.6 }}>
              Direct bank payouts to all Nigerian banks via dynamic failover registry: Paystack → Monnify → Squad. Features real-time NUBAN resolution and immediate transaction reversal safety.
            </p>
          </Card>

          <Card mode={mode} title="Live Exchange Rate Engine">
            <p style={{ fontSize: '14px', color: isLight ? '#475569' : '#94A3B8', lineHeight: 1.6 }}>
              Worker polls live Binance & Bybit P2P market depth, applies spread margins, and logs rate snapshots per transaction for SEC/CBN reconciliation and audit exports.
            </p>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)'}`,
          padding: '24px',
          textAlign: 'center',
          color: isLight ? '#64748B' : '#94A3B8',
          fontSize: '14px',
          fontFamily: "'Share Tech Mono', monospace"
        }}
      >
        Kudi Metropolis © 2026 · Monad Metropolis Hackathon Track A
      </footer>
    </div>
  );
}
