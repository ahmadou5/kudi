import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Kudi — Deposit Crypto & Instant Spend to NGN',
  description: 'Deposit USDC or Monad Metropolis AUSD and spend instantly to any Nigerian bank account at live P2P rates.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
