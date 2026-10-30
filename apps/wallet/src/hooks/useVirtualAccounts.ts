import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { sdk } from '../lib/sdk';

export interface VirtualAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  currency: string;
  provider: string;
}

export function useVirtualAccounts() {
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  return useQuery<VirtualAccount[]>({
    queryKey: ['virtualAccounts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await sdk.getVirtualAccounts(user.id);
      if (res && res.success && res.data) {
        return res.data.accounts || [];
      }
      return [];
    },
    enabled: isAuthenticated && !!user?.id
  });
}

export function useProvisionVirtualAccount() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);

  return useMutation<VirtualAccount[], Error>({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('You must be signed in to generate an account');
      }
      const res = await sdk.provisionVirtualAccount(user.id);
      if (res && res.success && res.data) {
        return res.data.accounts || [];
      }
      const message = typeof res?.message === 'string' ? res.message : undefined;
      throw new Error(message || 'Virtual account provisioning failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualAccounts', user?.id] });
    }
  });
}
