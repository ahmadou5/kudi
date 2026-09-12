import type { Metadata } from 'next';
import './globals.css';
import { ADMIN_APP_TITLE } from '@/lib/session';

export const metadata: Metadata = {
  title: `${ADMIN_APP_TITLE} · Monad Metropolis`,
  description: 'Kudi operations console for multi-chain custody deposits, FX oracle feeds, and fiat disbursements.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
