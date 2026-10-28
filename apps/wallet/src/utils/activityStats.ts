import type { MappedTransaction, TransactionDirection } from './transactionMapper';

export type RangeId = '7d' | '30d' | '90d' | 'all';

export const RANGES: { id: RangeId; label: string }[] = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'all', label: 'All' }
];

export interface StatsBucket {
  key: string;
  /** Short x-axis label (day number, weekday, month…). */
  label: string;
  /** Human label for tooltips ("Oct 28", "Oct 20 – 26"). */
  fullLabel: string;
  deposits: number;
  withdrawals: number;
  count: number;
}

export interface SplitRow {
  key: string;
  label: string;
  subLabel: string;
  volume: number;
  count: number;
  /** Share of total volume, 0–100. */
  pct: number;
}

export interface TopDay {
  key: string;
  label: string;
  volume: number;
  count: number;
  deposits: number;
  withdrawals: number;
}

export interface ActivitySummary {
  totalIn: number;
  totalOut: number;
  net: number;
  count: number;
  avgPerTx: number;
}

export interface ActivityStats {
  summary: ActivitySummary;
  buckets: StatsBucket[];
  byCategory: SplitRow[];
  byChain: SplitRow[];
  topDays: TopDay[];
  /** True when no transactions fall inside the selected range. */
  emptyInRange: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ALL_BUCKETS = 12;

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Start of the local day containing `date`. */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shortDayLabel(d: Date): string {
  return String(d.getDate());
}

function fullDayLabel(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function fullWeekdayLabel(d: Date): string {
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function fullMonthLabel(d: Date): string {
  return MONTHS_SHORT[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ` ’${String(d.getFullYear()).slice(2)}` : '');
}

/** Builds the empty daily/weekly/monthly buckets covering the selected range. */
function buildBuckets(range: RangeId, now: Date): StatsBucket[] {
  const buckets: StatsBucket[] = [];

  if (range === '7d' || range === '30d') {
    const days = range === '7d' ? 7 : 30;
    const today = startOfDay(now);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * DAY_MS);
      buckets.push({
        key: dayKey(d),
        label: shortDayLabel(d),
        fullLabel: fullDayLabel(d),
        deposits: 0,
        withdrawals: 0,
        count: 0
      });
    }
    return buckets;
  }

  if (range === '90d') {
    // 13 calendar weeks (Mon-start) ending with the current week.
    const today = startOfDay(now);
    const dow = today.getDay(); // 0 Sun … 6 Sat
    const daysSinceMonday = (dow + 6) % 7;
    const thisMonday = new Date(today.getTime() - daysSinceMonday * DAY_MS);
    for (let w = 12; w >= 0; w--) {
      const start = new Date(thisMonday.getTime() - w * 7 * DAY_MS);
      const end = new Date(start.getTime() + 6 * DAY_MS);
      const key = dayKey(start);
      buckets.push({
        key,
        label: `${start.getDate()}`,
        fullLabel: `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`,
        deposits: 0,
        withdrawals: 0,
        count: 0
      });
    }
    return buckets;
  }

  // 'all' — month buckets from earliest activity (capped) up to the current month.
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  buckets.push({
    key: monthKey(thisMonth),
    label: MONTHS_SHORT[thisMonth.getMonth()],
    fullLabel: fullMonthLabel(thisMonth),
    deposits: 0,
    withdrawals: 0,
    count: 0
  });
  return buckets;
}

/** Inserts month buckets backwards from the current month until `earliest`. */
function extendMonthBuckets(buckets: StatsBucket[], earliest: Date, now: Date): StatsBucket[] {
  const months: StatsBucket[] = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  const floor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);

  while (cursor.getTime() >= floor.getTime() && months.length < MAX_ALL_BUCKETS) {
    months.unshift({
      key: monthKey(cursor),
      label: MONTHS_SHORT[cursor.getMonth()],
      fullLabel: fullMonthLabel(cursor),
      deposits: 0,
      withdrawals: 0,
      count: 0
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return months.length > 0 ? months : buckets;
}

const CATEGORY_META: Record<TransactionDirection, { label: string; sub: string }> = {
  deposit: { label: 'Deposits', sub: 'Money in' },
  send: { label: 'Crypto sends', sub: 'On-chain out' },
  payout: { label: 'Bank payouts', sub: 'Cash out' }
};

const CHAIN_META: Record<string, { label: string; sub: string }> = {
  solana: { label: 'Solana', sub: 'USDC' },
  monad: { label: 'Monad', sub: 'AUSD' },
  other: { label: 'Other', sub: '—' }
};

/**
 * Aggregates mapped transactions into time-bucketed flow stats, category and
 * chain splits, and top activity days for the Insights overview screen.
 * Pure and deterministic — safe to memoize on the screen.
 */
export function computeActivityStats(
  txs: MappedTransaction[],
  range: RangeId,
  now: Date = new Date()
): ActivityStats {
  const cutoff =
    range === 'all'
      ? 0
      : startOfDay(now).getTime() - (range === '7d' ? 6 : range === '30d' ? 29 : 89) * DAY_MS;

  const inRange = txs.filter((t) => t.timestampMs >= cutoff && t.amountValue > 0);

  let buckets = buildBuckets(range, now);
  if (range === 'all' && inRange.length > 0) {
    const earliest = new Date(Math.min(...inRange.map((t) => t.timestampMs)));
    buckets = extendMonthBuckets(buckets, earliest, now);
  }
  const bucketIndex = new Map(buckets.map((b, i) => [b.key, i]));

  let totalIn = 0;
  let totalOut = 0;
  const categoryAgg = new Map<TransactionDirection, { volume: number; count: number }>();
  const chainAgg = new Map<string, { volume: number; count: number }>();
  const dayAgg = new Map<string, TopDay>();

  for (const tx of inRange) {
    const isDeposit = tx.direction === 'deposit';
    const volume = tx.amountValue;
    if (isDeposit) totalIn += volume;
    else totalOut += volume;

    // ── time bucket ──
    const d = new Date(tx.timestampMs);
    const key =
      range === '90d'
        ? (() => {
            const dow = d.getDay();
            const monday = startOfDay(new Date(d.getTime() - ((dow + 6) % 7) * DAY_MS));
            return dayKey(monday);
          })()
        : range === 'all'
          ? monthKey(d)
          : dayKey(d);
    const bi = bucketIndex.get(key);
    if (bi !== undefined) {
      if (isDeposit) buckets[bi].deposits += volume;
      else buckets[bi].withdrawals += volume;
      buckets[bi].count += 1;
    }

    // ── category ──
    const cat = categoryAgg.get(tx.direction) || { volume: 0, count: 0 };
    cat.volume += volume;
    cat.count += 1;
    categoryAgg.set(tx.direction, cat);

    // ── chain ──
    const rawChain = (tx.chain || '').toLowerCase();
    const chainKey = rawChain.includes('monad') ? 'monad' : rawChain.includes('solana') ? 'solana' : 'other';
    const ch = chainAgg.get(chainKey) || { volume: 0, count: 0 };
    ch.volume += volume;
    ch.count += 1;
    chainAgg.set(chainKey, ch);

    // ── top days ──
    const dk = dayKey(d);
    const day = dayAgg.get(dk) || {
      key: dk,
      label: fullWeekdayLabel(d),
      volume: 0,
      count: 0,
      deposits: 0,
      withdrawals: 0
    };
    day.volume += volume;
    day.count += 1;
    if (isDeposit) day.deposits += volume;
    else day.withdrawals += volume;
    dayAgg.set(dk, day);
  }

  const totalVolume = totalIn + totalOut;
  const pct = (v: number) => (totalVolume > 0 ? (v / totalVolume) * 100 : 0);

  const byCategory: SplitRow[] = (['deposit', 'send', 'payout'] as TransactionDirection[])
    .map((dir) => {
      const agg = categoryAgg.get(dir) || { volume: 0, count: 0 };
      return {
        key: dir,
        label: CATEGORY_META[dir].label,
        subLabel: CATEGORY_META[dir].sub,
        volume: agg.volume,
        count: agg.count,
        pct: pct(agg.volume)
      };
    })
    .filter((r) => r.count > 0);

  const byChain: SplitRow[] = Array.from(chainAgg.entries())
    .map(([key, agg]) => ({
      key,
      label: CHAIN_META[key]?.label || key,
      subLabel: CHAIN_META[key]?.sub || '',
      volume: agg.volume,
      count: agg.count,
      pct: pct(agg.volume)
    }))
    .sort((a, b) => b.volume - a.volume);

  const topDays = Array.from(dayAgg.values())
    .sort((a, b) => b.volume - a.volume || b.count - a.count)
    .slice(0, 3);

  return {
    summary: {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      count: inRange.length,
      avgPerTx: inRange.length > 0 ? totalVolume / inRange.length : 0
    },
    buckets,
    byCategory,
    byChain,
    topDays,
    emptyInRange: inRange.length === 0
  };
}

// ── formatting helpers shared by the Insights screen ──────────────────────────

export function formatUsd(value: number): string {
  return `$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatUsdCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$${(abs / 1_000).toFixed(1)}K`;
  return formatUsd(value);
}

export function formatNgnApprox(valueUsd: number, rateNGN: number): string {
  const ngn = valueUsd * rateNGN;
  return `≈ ₦${Math.abs(ngn).toLocaleString('en-US', {
    maximumFractionDigits: 0
  })}`;
}
