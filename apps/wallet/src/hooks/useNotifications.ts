import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { sdk } from '../lib/sdk';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

interface NotificationsData {
  notifications: AppNotification[];
  unreadCount: number;
}

/**
 * Single source of truth for the user's in-app notifications.
 *
 * Drives both the Header bell badge (unreadCount) and the /notifications feed,
 * so marking anything read in the feed instantly clears the badge — they share
 * the same ['notifications', userId] cache entry.
 */
export function useNotifications() {
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const queryClient = useQueryClient();

  const queryKey = ['notifications', user?.id] as const;

  const query = useQuery<NotificationsData>({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return { notifications: [], unreadCount: 0 };
      const res = await sdk.getNotifications(user.id);
      if (res && res.success && res.data) {
        return {
          notifications: res.data.data || [],
          unreadCount: res.data.unreadCount || 0
        };
      }
      return { notifications: [], unreadCount: 0 };
    },
    refetchInterval: 15_000,
    enabled: isAuthenticated && !!user?.id
  });

  const patchCache = (updater: (prev: NotificationsData) => NotificationsData) => {
    queryClient.setQueryData<NotificationsData>(queryKey, (prev) =>
      prev ? updater(prev) : prev
    );
  };

  // Optimistic: flip the item + decrement the count now, reconcile with the
  // server after. If the PATCH fails the invalidate puts truth back.
  const markRead = async (notificationId: string) => {
    const target = query.data?.notifications.find(n => n.id === notificationId);
    if (target?.read || !user?.id) return;

    patchCache(prev => ({
      notifications: prev.notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, prev.unreadCount - 1)
    }));

    try {
      await sdk.markNotificationRead(user.id, notificationId);
    } finally {
      await queryClient.invalidateQueries({ queryKey });
    }
  };

  const markAllRead = async () => {
    if (!user?.id) return;

    patchCache(prev => ({
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0
    }));

    try {
      await sdk.markAllNotificationsRead(user.id);
    } finally {
      await queryClient.invalidateQueries({ queryKey });
    }
  };

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    markRead,
    markAllRead
  };
}
