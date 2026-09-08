import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette, isLight } from '../lib/theme';
import { Typography } from '../constants/typography';
import { API_BASE_URL } from '../src/lib/sdk';
import { useAuthStore } from '../store/auth.store';

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

const filters = [
  { key: 'ALL', label: 'All' },
  { key: 'UNREAD', label: 'Unread' },
] as const;

function getIconForType(type: string) {
  const t = (type || '').toUpperCase();
  if (t.includes('DEPOSIT') || t.includes('PAYMENT_RECEIVED')) return { name: 'arrow-down-circle', color: '#10B981', bg: 'rgba(16,185,129,0.12)' };
  if (t.includes('SPEND') || t.includes('PAYOUT') || t.includes('TRANSFER')) return { name: 'arrow-up-circle', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' };
  if (t.includes('KYC') || t.includes('SECURITY')) return { name: 'shield-checkmark', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' };
  return { name: 'notifications', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' };
}

function formatRelativeTime(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsFeedScreen() {
  const palette = useAppPalette();
  const light = isLight(palette.bg);
  const user = useAuthStore((s) => s.user);

  const [filter, setFilter] = useState<(typeof filters)[number]['key']>('ALL');
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const userId = user?.id || 'usr_1788867509637';

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/notifications`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setNotifications(json.data.data || []);
          setUnreadCount(json.data.unreadCount || 0);
        }
      }
    } catch (err) {
      console.warn('Error fetching notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [userId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkOneRead = async (item: AppNotification) => {
    setSelected(item);
    if (!item.read) {
      // Optimistic update
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));

      try {
        await fetch(`${API_BASE_URL}/api/v1/users/${userId}/notifications/${item.id}/read`, {
          method: 'PATCH'
        });
      } catch (e) {
        // Fallback
      }
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch(`${API_BASE_URL}/api/v1/users/${userId}/notifications/read-all`, {
        method: 'PATCH'
      });
    } catch (e) {
      // Fallback
    } finally {
      setMarkingAll(false);
    }
  };

  const filteredList = useMemo(() => {
    return filter === 'UNREAD' ? notifications.filter(n => !n.read) : notifications;
  }, [filter, notifications]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      {/* Header Bar */}
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>

        <Text style={[Typography.title2, { color: palette.text }]}>Notifications</Text>

        {/* Gear Icon linking to Preferences Settings */}
        <TouchableOpacity
          onPress={() => router.push('/settings/notifications')}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={20} color={palette.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {/* Unread Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: light ? '#0F172A' : '#1E293B' }]}>
          <View>
            <Text style={styles.summaryLabel}>UNREAD UPDATES</Text>
            <Text style={styles.summaryValue}>{unreadCount}</Text>
          </View>
          <TouchableOpacity
            onPress={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            style={[styles.markAllBtn, { opacity: unreadCount > 0 ? 1 : 0.5 }]}
            activeOpacity={0.8}
          >
            {markingAll ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                <Text style={styles.markAllText}>Mark all read</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {filters.map((f) => {
            const active = f.key === filter;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? '#10B981' : palette.card,
                    borderColor: active ? '#10B981' : palette.border
                  }
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, { color: active ? '#FFFFFF' : palette.text }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Feed List */}
        {loading ? (
          <View style={[styles.stateCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={[Typography.bodyBold, { color: palette.text, marginTop: 12 }]}>Loading Notifications</Text>
            <Text style={[Typography.subhead, { color: palette.textSecondary }]}>Fetching your latest wallet activity...</Text>
          </View>
        ) : filteredList.length > 0 ? (
          <View style={styles.list}>
            {filteredList.map((item) => {
              const iconInfo = getIconForType(item.type);
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleMarkOneRead(item)}
                  style={[
                    styles.notificationCard,
                    {
                      backgroundColor: palette.card,
                      borderColor: item.read ? palette.border : '#10B981'
                    }
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconWrap, { backgroundColor: iconInfo.bg }]}>
                    <Ionicons name={iconInfo.name as any} size={22} color={iconInfo.color} />
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {!item.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={[styles.cardText, { color: palette.textSecondary }]} numberOfLines={2}>
                      {item.body}
                    </Text>
                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={12} color={palette.textSecondary} />
                      <Text style={[styles.timeText, { color: palette.textSecondary }]}>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={[styles.stateCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Ionicons name="notifications-off-outline" size={32} color={palette.textSecondary} />
            <Text style={[Typography.bodyBold, { color: palette.text, marginTop: 8 }]}>No Notifications</Text>
            <Text style={[Typography.subhead, { color: palette.textSecondary, textAlign: 'center' }]}>
              {filter === 'UNREAD' ? 'You have no unread notification updates.' : 'Incoming deposits, transfers, and system alerts will appear here.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Notification Detail Bottom Sheet Modal */}
      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          <View style={[styles.detailSheet, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[Typography.title3, { color: palette.text }]}>{selected?.title}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={palette.text} />
              </TouchableOpacity>
            </View>

            <Text style={[Typography.body, { color: palette.textSecondary, marginTop: 8, lineHeight: 22 }]}>
              {selected?.body}
            </Text>

            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 12 }]}>
              Received: {selected ? new Date(selected.createdAt).toLocaleString() : ''}
            </Text>

            <TouchableOpacity
              onPress={() => setSelected(null)}
              style={[styles.dismissBtn, { backgroundColor: '#10B981' }]}
              activeOpacity={0.8}
            >
              <Text style={styles.dismissBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16
  },
  summaryCard: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)'
  },
  markAllText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10
  },
  filterChip: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700'
  },
  list: {
    gap: 12
  },
  notificationCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start'
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardBody: {
    flex: 1,
    gap: 4
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginLeft: 8
  },
  cardText: {
    fontSize: 13,
    lineHeight: 18
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4
  },
  timeText: {
    fontSize: 11
  },
  stateCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  detailSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    gap: 8
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  closeBtn: {
    padding: 4
  },
  dismissBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16
  },
  dismissBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  }
});
