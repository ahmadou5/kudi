import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { sdk } from '../lib/sdk';

interface ReferralInvitedUser {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  joinedAt: string;
}

interface ReferralOverview {
  code: string;
  invitedCount: number;
  invited: ReferralInvitedUser[];
}

export function useReferral() {
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  return useQuery<ReferralOverview>({
    queryKey: ['referralOverview', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not logged in');
      const res = await sdk.getReferralOverview();
      if (res && res.success && res.data) {
        return res.data as ReferralOverview;
      }
      const message = typeof res?.message === 'string' ? res.message : 'Failed to load referral data';
      throw new Error(message);
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });
}
