'use client';

import './globals.css';
import React, { useState } from 'react';
import { Badge, ThemeToggle, ThemeMode } from '@kudi/ui';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const isLight = mode === 'light';

  return (
    <html lang="en" data-theme={mode}>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <header
            style={{
              borderBottom: `1px solid ${isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)'}`,
              padding: '16px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(9, 10, 15, 0.85)',
              backdropFilter: 'blur(12px)',
              transition: 'background 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: isLight
                    ? 'linear-gradient(135deg, #0F172A, #475569)'
                    : 'linear-gradient(135deg, #F8FAFC, #94A3B8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Smooch Sans', sans-serif",
                  fontWeight: 900,
                  fontSize: '24px',
                  color: isLight ? '#FFFFFF' : '#0F172A'
                }}
              >
                K
              </div>
              <span
                style={{
                  fontFamily: "'Smooch Sans', sans-serif",
                  fontSize: '28px',
                  fontWeight: 800,
                  color: isLight ? '#0F172A' : '#FFFFFF'
                }}
              >
                Kudi Ops Console
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Badge variant="silver" mode={mode}>
                Track A: Self-Custody Active
              </Badge>
              <Badge variant="success" mode={mode}>
                Monad Metropolis
              </Badge>
              <ThemeToggle mode={mode} onToggle={setMode} />
            </div>
          </header>
          <main style={{ flex: 1, padding: '32px' }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
