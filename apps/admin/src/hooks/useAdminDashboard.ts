import { useState, useEffect } from 'react';
import { PaymentProviderId } from '@kudi/types';
import { KudiSDK } from '@kudi/sdk';
import { ChainConfigItem } from '../components/ChainConfigCard';

const sdk = new KudiSDK({ baseUrl: 'http://localhost:4000' });

export function useAdminDashboard() {
  const [activeProvider, setActiveProvider] = useState<PaymentProviderId>(PaymentProviderId.PAYSTACK);
  const [rateOverride, setRateOverride] = useState<string>('1585.50');
  const [evmChains, setEvmChains] = useState<ChainConfigItem[]>([
    { id: 'monad-testnet', name: 'Monad Metropolis Testnet', token: 'AUSD', enabled: true, rpcUrl: 'https://testnet-rpc.monad.xyz' },
    { id: 'polygon-mainnet', name: 'Polygon PoS', token: 'USDC', enabled: false, rpcUrl: 'https://polygon-rpc.com' }
  ]);

  useEffect(() => {
    sdk.getAdminConfig()
      .then((cfg) => {
        if (cfg.activePaymentProvider) {
          setActiveProvider(cfg.activePaymentProvider as PaymentProviderId);
        }
        if (cfg.rateState?.currentRateNGN) {
          setRateOverride(cfg.rateState.currentRateNGN.toFixed(2));
        }
      })
      .catch(() => {});
  }, []);

  const handleProviderSwitch = async (provider: PaymentProviderId) => {
    try {
      await sdk.setActivePaymentProvider(provider);
      setActiveProvider(provider);
    } catch {
      setActiveProvider(provider);
    }
  };

  const handleRateOverrideSubmit = async () => {
    const rateVal = parseFloat(rateOverride);
    if (!rateVal || rateVal <= 0) return;
    try {
      await sdk.overrideRate(rateVal);
    } catch {}
  };

  const toggleEvmChain = (id: string) => {
    setEvmChains((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  return {
    activeProvider,
    rateOverride,
    setRateOverride,
    evmChains,
    handleProviderSwitch,
    handleRateOverrideSubmit,
    toggleEvmChain
  };
}
