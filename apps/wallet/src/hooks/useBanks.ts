import { useEffect, useState } from 'react';
import { sdk } from '../lib/sdk';
import { NIGERIAN_BANKS } from '../constants/banks';
import type { BankItem } from '../components/wallet/BankPickerModal';
import { BANK_SLUGS_MAP } from '../components/wallet/BankPickerModal';

/**
 * Fetches the bank list from the active payment provider via the API.
 * Enriches each entry with a logo slug from our local map so logos always
 * resolve correctly regardless of what the provider returns.
 * Falls back to the static NIGERIAN_BANKS list if the request fails.
 */
export function useBanks() {
  const [banks, setBanks] = useState<BankItem[]>(NIGERIAN_BANKS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBanks = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await sdk.getSupportedBanks();
        if (cancelled) return;

        const raw: Array<{ code: string; name: string }> = res?.data?.banks ?? [];

        if (raw.length > 0) {
          // Merge API list with our static list so we always have full names and slugs.
          // Static entries take precedence (they have better names + slugs).
          const staticByCode = new Map(NIGERIAN_BANKS.map((b) => [b.code, b]));
          const merged: BankItem[] = raw.map((apiBank) => {
            const local = staticByCode.get(apiBank.code);
            if (local) return local; // prefer local — better name & slug
            return {
              code: apiBank.code,
              name: apiBank.name,
              slug: (BANK_SLUGS_MAP as Record<string, string>)[apiBank.code] ?? null,
            };
          });

          // Also include any local banks not returned by the API (rarer providers may omit some)
          const mergedCodes = new Set(merged.map((b) => b.code));
          NIGERIAN_BANKS.forEach((b) => {
            if (!mergedCodes.has(b.code)) merged.push(b);
          });

          setBanks(merged);
        } else {
          // Empty API response → keep static list
          setBanks(NIGERIAN_BANKS);
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load banks');
        setBanks(NIGERIAN_BANKS); // graceful fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchBanks();
    return () => { cancelled = true; };
  }, []);

  return { banks, loading, error };
}
