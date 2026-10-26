import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  Bell,
  CheckCheck,
  Clock,
  Inbox,
  LucideIcon,
  Mail,
  ShieldCheck,
  X
} from 'lucide-react-native';
import { useAppPalette, hexToRgba, readableInk } from '../src/lib/theme';
import { Typography } from '../src/constants/typography';
import { Spacing } from '../src/constants/spacing';
import { useNotifications, type AppNotification } from '../src/hooks/useNotifications';
import { haptics } from '../src/lib/haptics';
import { GorhomBottomSheet } from '../src/components/ui/GorhomBottomSheet';
import { NotificationEmptyVisual } from '../src/components/NotificationEmptyVisual';

export type { AppNotification };

type NotificationFilter = {
  key: string;
  title: string;
  Icon: LucideIcon;
  predicate: (notification: AppNotification) => boolean;
};

const filters: NotificationFilter[] = [
  { key: 'ALL', title: 'All activity', Icon: Inbox, predicate: () => true },
  { key: 'UNREAD', title: 'Unread', Icon: Mail, predicate: (n) => !n.read }
];

function getIconForType(type: string): LucideIcon {
  const t = (type || '').toUpperCase();
  if (t.includes('DEPOSIT') || t.includes('PAYMENT_RECEIVED')) return ArrowDownCircle;
  if (t.includes('SPEND') || t.includes('PAYOUT') || t.includes('TRANSFER')) return ArrowUpCircle;
  if (t.includes('KYC') || t.includes('SECURITY')) return ShieldCheck;
  return Bell;
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
  const {
    notifications,
    unreadCount,
    isLoading: loading,
    refetch,
    markRead,
    markAllRead
  } = useNotifications();

  const [filter, setFilter] = useState<string>(filters[0].key);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const tileTint = hexToRgba(palette.text, 0.07);
  const labelColor = hexToRgba(palette.text, 0.45);
  const mutedColor = hexToRgba(palette.text, 0.5);
  const faintColor = hexToRgba(palette.text, 0.4);
  const ink = readableInk(palette.primary);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleMarkOneRead = async (item: AppNotification) => {
    haptics.tap();
    setSelected(item);
    if (!item.read) {
      await markRead(item.id);
    }
  };

  const handleMarkAllRead = async () => {
    haptics.tap();
    setMarkingAll(true);
    try {
      await markAllRead();
    } finally {
      setMarkingAll(false);
    }
  };

  const activeFilter = filters.find((f) => f.key === filter) || filters[0];

  const filteredList = useMemo(() => {
    return notifications.filter(activeFilter.predicate);
  }, [notifications, activeFilter]);

  const sectionLabel = `${activeFilter.title} · ${filteredList.length}`;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibility-label="Go back"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: palette.card, borderColor: palette.border },
            pressed && { opacity: 0.6 }
          ]}
        >
          <ArrowLeft size={20} color={palette.text} />
        </Pressable>
        <Text style={[Typography.title1, { color: palette.text }]}>Notifications</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />
        }
      >
        <View style={styles.filterRow}>
          {filters.map((f) => {
            const active = f.key === filter;
            const FilterIcon = f.Icon;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  haptics.tap();
                  setFilter(f.key);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={f.title}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: active ? palette.primary : palette.card,
                    borderColor: active ? palette.primary : palette.border
                  },
                  pressed && { opacity: 0.85 }
                ]}
              >
                <FilterIcon
                  size={17}
                  strokeWidth={2}
                  color={active ? ink : palette.textSecondary}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: labelColor }]}>{sectionLabel}</Text>
          <Pressable
            onPress={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.markAllBtn,
              (markingAll || unreadCount === 0) && { opacity: 0.4 },
              pressed && !markingAll && unreadCount > 0 && { opacity: 0.6 }
            ]}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <>
                <CheckCheck size={14} color={palette.primary} />
                <Text style={[styles.markAllText, { color: palette.primary }]}>Mark all read</Text>
              </>
            )}
          </Pressable>
        </View>

        {loading ? (
          <View style={[styles.stateCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={[Typography.bodyBold, { color: palette.text, marginTop: 12 }]}>
              Loading notifications
            </Text>
            <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
              Fetching your latest wallet activity...
            </Text>
          </View>
        ) : filteredList.length > 0 ? (
          <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {filteredList.map((item, index) => {
              const ItemIcon = getIconForType(item.type);
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && <View style={[styles.divider, { backgroundColor: palette.border }]} />}
                  <Pressable
                    onPress={() => handleMarkOneRead(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}. ${item.body}`}
                    style={({ pressed }) => [
                      styles.row,
                      !item.read && { backgroundColor: hexToRgba(palette.primary, 0.06) },
                      pressed && { backgroundColor: hexToRgba(palette.text, 0.05) }
                    ]}
                  >
                    <View style={[styles.iconTile, { backgroundColor: tileTint }]}>
                      <ItemIcon size={19} color={palette.textSecondary} strokeWidth={1.9} />
                    </View>

                    <View style={styles.rowCopy}>
                      <View style={styles.rowTitleRow}>
                        <Text
                          style={[styles.rowTitle, { color: palette.text }]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {!item.read && (
                          <View style={[styles.unreadDot, { backgroundColor: palette.primary }]} />
                        )}
                      </View>
                      <Text
                        style={[styles.rowSubtitle, { color: mutedColor }]}
                        numberOfLines={2}
                      >
                        {item.body}
                      </Text>
                      <View style={styles.timeRow}>
                        <Clock size={11} color={faintColor} />
                        <Text style={[styles.timeText, { color: faintColor }]}>
                          {formatRelativeTime(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: palette.card, borderColor: palette.border }
              ]}
            >
              <NotificationEmptyVisual />

              <Text style={[Typography.title3, styles.emptyTitle, { color: palette.text }]}>
                No notifications
              </Text>
              <Text
                style={[Typography.subhead, styles.emptyBody, { color: hexToRgba(palette.text, 0.55) }]}
              >
                {notifications.length > 0
                  ? 'Nothing here right now — the rest of your activity is under All activity.'
                  : 'Incoming deposits, transfers, and system alerts will appear here.'}
              </Text>

              <View style={styles.emptyActions}>
                {notifications.length > 0 && (
                  <Pressable
                    onPress={() => {
                      haptics.tap();
                      setFilter(filters[0].key);
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      { backgroundColor: palette.text, borderColor: palette.border },
                      pressed && { opacity: 0.85 }
                    ]}
                  >
                    <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                      Show {filters[0].title.toLowerCase()}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => {
                    haptics.tap();
                    void onRefresh();
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    notifications.length > 0 ? styles.secondaryBtn : styles.primaryBtn,
                    notifications.length > 0
                      ? { backgroundColor: palette.card, borderColor: palette.border }
                      : { backgroundColor: palette.text, borderColor: palette.border },
                    pressed && { opacity: 0.7 }
                  ]}
                >
                  <Text
                    style={[
                      Typography.bodyBold,
                      { color: notifications.length > 0 ? palette.text : palette.bg }
                    ]}
                  >
                    Refresh
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <GorhomBottomSheet
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        scrollable
      >
        <View style={styles.sheetHeader}>
          <Text
            style={[Typography.title3, { color: palette.text, flex: 1, paddingRight: 12 }]}
            numberOfLines={2}
          >
            {selected?.title}
          </Text>
          <Pressable
            onPress={() => setSelected(null)}
            accessibilityRole="button"
            accessibility-label="Close"
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          >
            <X size={20} color={palette.text} />
          </Pressable>
        </View>

        <Text style={[Typography.body, { color: palette.textSecondary, marginTop: 8, lineHeight: 22 }]}>
          {selected?.body}
        </Text>

        <Text style={[Typography.caption, { color: labelColor, marginTop: 12 }]}>
          {selected ? `Received: ${new Date(selected.createdAt).toLocaleString()}` : ''}
        </Text>

        <Pressable
          onPress={() => {
            haptics.tap();
            setSelected(null);
          }}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.dismissBtn,
            { backgroundColor: palette.primary },
            pressed && { opacity: 0.85 }
          ]}
        >
          <Text style={[styles.dismissBtnText, { color: ink }]}>Dismiss</Text>
        </Pressable>
      </GorhomBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 16
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center'
  },
  emptyCard: {
    flex: 1,
    minHeight: 300,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyTitle: {
    marginTop: 20,
    textAlign: 'center'
  },
  emptyBody: {
    marginTop: 6,
    maxWidth: 260,
    textAlign: 'center'
  },
  emptyActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 22
  },
  primaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 14,
    borderWidth: 1
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 14,
    borderWidth: 1
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  filterChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4
  },
  sectionLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase'
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12
  },
  markAllText: {
    fontFamily: Typography.family.sans,
    fontSize: 13
  },
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden'
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  divider: {
    height: 1,
    marginLeft: 66
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowCopy: {
    flex: 1,
    gap: 4
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rowTitle: {
    fontFamily: Typography.family.sans,
    fontSize: 15,
    lineHeight: 20,
    flex: 1
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8
  },
  rowSubtitle: {
    fontFamily: Typography.family.sans,
    fontSize: 13,
    lineHeight: 18
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  timeText: {
    fontFamily: Typography.family.sans,
    fontSize: 12,
    lineHeight: 16
  },
  stateCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  closeBtn: {
    padding: 4
  },
  dismissBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20
  },
  dismissBtnText: {
    fontFamily: Typography.family.sans,
    fontSize: 15
  }
});
