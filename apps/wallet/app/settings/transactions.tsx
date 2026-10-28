import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { router } from 'expo-router';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { ArrowLeft, ArrowUpDown, Check, ChevronDown, Search, SearchX, Wallet, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppPalette, hexToRgba } from '../../src/lib/theme';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { useTransactions } from '../../src/hooks/useTransactions';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';
import { mapApiTransactions, TransactionDirection } from '../../src/utils/transactionMapper';
import { TransactionCard } from '../../src/components/TransactionCard';
import { AnimatedSkeleton } from '../../src/components/ui/AnimatedSkeleton';
import { useEnterFadeInDown } from '../../src/lib/animations';
import { haptics } from '../../src/lib/haptics';

type FilterId = 'all' | TransactionDirection;
type SortId = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'deposit', label: 'Deposits' },
  { id: 'send', label: 'Sends' },
  { id: 'payout', label: 'Payouts' }
];

const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'amount_desc', label: 'Amount: high to low' },
  { id: 'amount_asc', label: 'Amount: low to high' }
];

function ListRow({ index, children }: { index: number; children: React.ReactNode }) {
  const entering = useEnterFadeInDown(Math.min(index, 8));
  return (
    <Animated.View
      entering={entering}
      layout={LinearTransition.springify().damping(20).mass(0.7).stiffness(180)}
    >
      {children}
    </Animated.View>
  );
}

export default function SettingsTransactionsScreen() {
  const palette = useAppPalette();
  const { userId, rateNGN } = useKudiWallet();
  const { data: apiTxs, isLoading, refetch, isRefetching } = useTransactions(100);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [sort, setSort] = useState<SortId>('newest');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const enterSearch = useEnterFadeInDown(0);
  const enterChips = useEnterFadeInDown(1);
  const enterCount = useEnterFadeInDown(2);
  const enterList = useEnterFadeInDown(3);

  const mapped = useMemo(
    () => mapApiTransactions(apiTxs, userId, rateNGN),
    [apiTxs, userId, rateNGN]
  );

  const filtersActive = filter !== 'all' || query.trim().length > 0;

  const filtered = useMemo(() => {
    let items = mapped;
    if (filter !== 'all') {
      items = items.filter((t) => t.direction === filter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.subtitle || '').toLowerCase().includes(q) ||
          t.amount.toLowerCase().includes(q) ||
          (t.ref || '').toLowerCase().includes(q)
      );
    }
    const sorted = [...items];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.timestampMs - b.timestampMs;
        case 'amount_desc':
          return b.amountValue - a.amountValue;
        case 'amount_asc':
          return a.amountValue - b.amountValue;
        default:
          return b.timestampMs - a.timestampMs;
      }
    });
    return sorted;
  }, [mapped, filter, query, sort]);

  const clearFilters = () => {
    haptics.tap();
    setQuery('');
    setFilter('all');
  };

  const selectFilter = (id: FilterId) => {
    if (id === filter) return;
    haptics.tap();
    setFilter(id);
  };

  const selectSort = (id: SortId) => {
    haptics.tap();
    setSort(id);
    setSortSheetOpen(false);
  };

  const activeSortLabel = SORT_OPTIONS.find((o) => o.id === sort)?.label || 'Newest first';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      {/* Header */}
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
        <Text style={[Typography.title1, { color: palette.text }]}>Transactions</Text>
      </View>

      {/* Controls: search + filter chips + sort */}
      <Animated.View entering={enterSearch} style={styles.controls}>
        <View
          style={[
            styles.searchWrapper,
            {
              backgroundColor: palette.card,
              borderColor: searchFocused ? palette.text : palette.border,
              borderWidth: searchFocused ? 1.5 : 1
            }
          ]}
        >
          <Search size={18} color={searchFocused ? palette.text : palette.textSecondary} />
          <TextInput
            value={query}
            onChangeText={(v) => {
              setQuery(v);
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search by name, amount or reference"
            placeholderTextColor={hexToRgba(palette.text, 0.35)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[Typography.currencySub, styles.searchInput, { color: palette.text }]}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityLabel="Clear search"
            >
              <X size={16} color={palette.textSecondary} />
            </Pressable>
          )}
        </View>

        <Animated.View entering={enterChips} style={styles.chipsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
          >
            {FILTERS.map((f) => {
              const selected = filter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => selectFilter(f.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.chip,
                    selected
                      ? { backgroundColor: palette.text, borderColor: palette.text }
                      : { backgroundColor: palette.card, borderColor: palette.border },
                    pressed && { opacity: 0.75 }
                  ]}
                >
                  <Text
                    style={[
                      Typography.currencySub,
                      { fontSize: 12 },
                      { color: selected ? palette.bg : palette.text }
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => {
              haptics.tap();
              setSortSheetOpen(true);
            }}
            accessibilityRole="button"
            accessibility-label={`Sort: ${activeSortLabel}`}
            style={({ pressed }) => [
              styles.sortChip,
              { backgroundColor: palette.card, borderColor: palette.border },
              pressed && { opacity: 0.75 }
            ]}
          >
            <ArrowUpDown size={14} color={palette.textSecondary} />
            <Text style={[Typography.currencySub, { fontSize: 12, color: palette.text }]}>Sort</Text>
            <ChevronDown size={13} color={palette.textSecondary} />
          </Pressable>
        </Animated.View>
      </Animated.View>

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={palette.text}
            colors={[palette.text]}
          />
        }
      >
        {/* Count + clear */}
        <Animated.View entering={enterCount} style={styles.countRow}>
          <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
            {isLoading
              ? 'Loading…'
              : `${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`}
            {!isLoading && filtersActive && filter !== 'all'
              ? ` · ${FILTERS.find((f) => f.id === filter)?.label}`
              : ''}
            {!isLoading && sort !== 'newest' ? ` · ${activeSortLabel}` : ''}
          </Text>
          {filtersActive && (
            <Pressable onPress={clearFilters} hitSlop={8}>
              <Text style={[Typography.footnote, { color: palette.text, fontWeight: '700' }]}>
                Clear
              </Text>
            </Pressable>
          )}
        </Animated.View>

        {isLoading && filtered.length === 0 ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[styles.skeletonCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <View style={styles.skeletonRow}>
                  <AnimatedSkeleton width={40} height={40} borderRadius={20} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <AnimatedSkeleton width={120} height={14} borderRadius={4} />
                    <AnimatedSkeleton width={80} height={10} borderRadius={4} />
                  </View>
                  <AnimatedSkeleton width={64} height={16} borderRadius={4} />
                </View>
              </View>
            ))}
          </View>
        ) : filtered.length > 0 ? (
          <Animated.View
            key={`${filter}-${sort}`}
            entering={enterList}
            style={{ gap: 12 }}
          >
            {filtered.map((item, index) => (
              <ListRow key={item.id || item.ref || String(index)} index={index}>
                <TransactionCard item={item} />
              </ListRow>
            ))}
          </Animated.View>
        ) : mapped.length === 0 ? (
          <Animated.View
            entering={enterList}
            style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={[styles.emptyIconTile, { backgroundColor: hexToRgba(palette.text, 0.07) }]}>
              <Wallet size={22} color={palette.textSecondary} strokeWidth={1.9} />
            </View>
            <Text style={[Typography.bodyBold, { color: palette.text, marginTop: 4 }]}>
              No transactions yet
            </Text>
            <Text
              style={[
                Typography.footnote,
                { color: hexToRgba(palette.text, 0.5), textAlign: 'center', maxWidth: 260 }
              ]}
            >
              Deposits, sends and payouts will show up here as soon as they settle.
            </Text>
            <Pressable
              onPress={() => refetch()}
              style={({ pressed }) => [
                styles.emptyAction,
                { backgroundColor: palette.bg, borderColor: palette.border },
                pressed && { opacity: 0.7 }
              ]}
            >
              {isRefetching ? (
                <ActivityIndicator size="small" color={palette.text} />
              ) : (
                <Text style={[Typography.currencySub, { color: palette.text, fontSize: 12 }]}>
                  Refresh
                </Text>
              )}
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View
            entering={enterList}
            style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={[styles.emptyIconTile, { backgroundColor: hexToRgba(palette.text, 0.07) }]}>
              <SearchX size={22} color={palette.textSecondary} strokeWidth={1.9} />
            </View>
            <Text style={[Typography.bodyBold, { color: palette.text, marginTop: 4 }]}>
              No matching transactions
            </Text>
            <Text
              style={[
                Typography.footnote,
                { color: hexToRgba(palette.text, 0.5), textAlign: 'center', maxWidth: 260 }
              ]}
            >
              Try a different search or clear your filters.
            </Text>
            <Pressable
              onPress={clearFilters}
              style={({ pressed }) => [
                styles.emptyAction,
                { backgroundColor: palette.text, borderColor: palette.text },
                pressed && { opacity: 0.8 }
              ]}
            >
              <Text style={[Typography.currencySub, { color: palette.bg, fontSize: 12 }]}>
                Clear search & filters
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* Sort sheet */}
      <Modal
        visible={sortSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSortSheetOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSortSheetOpen(false)} />
          <View
            style={[styles.sheet, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={[styles.grabber, { backgroundColor: hexToRgba(palette.text, 0.18) }]} />
            <Text
              style={[
                Typography.currencySub,
                { color: palette.text, alignSelf: 'flex-start', fontSize: 20 }
              ]}
            >
              Sort by
            </Text>
            {SORT_OPTIONS.map((option) => {
              const active = option.id === sort;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => selectSort(option.id)}
                  style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.7 }]}
                >
                  <Text
                    style={[
                      Typography.currencySub,
                      { flex: 1, color: active ? palette.text : hexToRgba(palette.text, 0.7) }
                    ]}
                  >
                    {option.label}
                  </Text>
                  {active && <Check size={18} color={palette.text} />}
                </Pressable>
              );
            })}
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
  controls: {
    paddingHorizontal: Spacing.md,
    gap: 12,
    paddingBottom: 8
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 24
  },
  searchInput: {
    flex: 1,
    padding: 0,
    height: '100%'
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  chipsContent: {
    gap: 8,
    paddingRight: 4
  },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    borderWidth: 1
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: 6,
    paddingBottom: 40
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12
  },
  skeletonCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6
  },
  emptyIconTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  emptyAction: {
    marginTop: 12,
    paddingHorizontal: 20,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end'
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 4
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14
  }
});
