import React, { useMemo, useState, useEffect } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search, CheckCircle2 } from 'lucide-react-native';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

export type BankItem = {
  name: string;
  code: string;
  slug?: string | null;
  logoKey?: string | null;
};

type BankPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (bank: BankItem) => void;
  selectedBankCode?: string;
  banks: BankItem[];
  banksLoading?: boolean;
};

const BANK_PALETTE = [
  '#0A84FF', '#30D158', '#FF9F0A', '#FF375F', '#BF5AF2',
  '#32ADE6', '#FF6961', '#5AC8FA', '#AC8E68', '#34C759',
];

function hexToRgba(hex: string, opacity: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((char) => char + char).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${opacity})`;
}

function bankInitialColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return BANK_PALETTE[Math.abs(hash) % BANK_PALETTE.length];
}

export function BankAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const color = bankInitialColor(name);
  const initial = name.trim().charAt(0).toUpperCase() || 'B';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: hexToRgba(color, 0.14),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color, fontSize: size * 0.4, fontWeight: '700' }}>
        {initial}
      </Text>
    </View>
  );
}

/**
 * Fallback slug map for banks that don't carry a `slug` field directly.
 * Prefer using the `slug` property on the BankItem itself.
 */
/** Exported for use in useBanks hook and other consumers. */
export const BANK_SLUGS_MAP: Record<string, string> = {
  '011': 'first-bank-of-nigeria',
  '023': 'citibank-nigeria',
  '032': 'union-bank-of-nigeria',
  '033': 'united-bank-for-africa',
  '035': 'wema-bank',
  '044': 'access-bank',
  '050': 'ecobank-nigeria',
  '057': 'zenith-bank',
  '058': 'gtbank',
  '063': 'access-bank',
  '068': 'standard-chartered-bank-nigeria',
  '070': 'fidelity-bank',
  '076': 'polaris-bank',
  '082': 'keystone-bank',
  '100': 'suntrust-bank-nigeria',
  '101': 'providus-bank',
  '214': 'first-city-monument-bank',
  '215': 'unity-bank',
  '221': 'stanbic-ibtc-bank',
  '232': 'sterling-bank',
  '301': 'jaiz-bank',
  '302': 'taj-bank',
  '304': 'lotus-bank',
  '305': 'optimus-bank',
  '307': 'globus-bank',
  '315': 'premium-trust-bank',
  '318': 'titan-trust-bank',
  '50126': 'carbon',
  '50162': 'fairmoney',
  '50211': 'kuda-bank',
  '50304': 'vfd-microfinance-bank',
  '50515': 'moniepoint-mfb-ng',
  '90616': 'paga',
  '120001': '9-payment-service-bank',
  '999991': 'palmpay',
  '999992': 'opay',
};

const LOGO_BASE = 'https://cdn.jsdelivr.net/gh/supermx1/nigerian-banks-api@main/logos';

export function getBankLogoUrl(bankCode?: string, bankName?: string, slug?: string | null): string {
  // 1. Prefer the explicit slug on the item
  if (slug) return `${LOGO_BASE}/${slug}.png`;
  // 2. Fall back to our hardcoded map
  const code = bankCode?.trim();
  if (code && BANK_SLUGS_MAP[code]) return `${LOGO_BASE}/${BANK_SLUGS_MAP[code]}.png`;
  // 3. Last resort: derive from name
  const cleanName = bankName?.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
  return `${LOGO_BASE}/${cleanName || 'default'}.png`;
}

export function BankLogo({
  name,
  bankCode,
  slug,
  size = 40,
}: {
  name: string;
  bankCode?: string | null;
  slug?: string | null;
  size?: number;
}) {
  const palette = useAppPalette();
  const url = getBankLogoUrl(bankCode || undefined, name, slug);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (failed) {
    return <BankAvatar name={name} size={size} />;
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        overflow: 'hidden',
        backgroundColor: palette.card,
        borderColor: palette.border,
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Image
        source={{ uri: url }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
        }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

export function BankPickerModal({
  visible,
  onClose,
  onSelect,
  selectedBankCode,
  banks,
  banksLoading = false,
}: BankPickerModalProps) {
  const palette = useAppPalette();
  const [search, setSearch] = useState('');

  const filteredBanks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return banks;
    return banks.filter((bank) =>
      `${bank.name} ${bank.code}`.toLowerCase().includes(term)
    );
  }, [search, banks]);

  useEffect(() => {
    if (!visible) setSearch('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Choose a bank</Text>
              <Text style={[styles.modalSubtitle, { color: palette.textSecondary }]}>
                {banks.length} banks available
              </Text>
            </View>
            <Pressable onPress={onClose} style={[styles.modalClose, { backgroundColor: palette.bg }]}>
              <Text style={[styles.modalCloseText, { color: palette.text }]}>Close</Text>
            </Pressable>
          </View>

          {/* Functional search input */}
          <View style={[styles.searchBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <Search size={16} color={palette.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search bank name or code…"
              placeholderTextColor={palette.textSecondary}
              style={[styles.searchInput, { color: palette.text }]}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          {banksLoading ? (
            <View style={styles.bankLoading}>
              <Text style={{ color: palette.textSecondary }}>Loading bank list…</Text>
            </View>
          ) : filteredBanks.length === 0 ? (
            <View style={styles.bankLoading}>
              <Text style={{ color: palette.textSecondary }}>
                {search ? 'No banks matched your search.' : 'No banks available.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => item.code}
              style={styles.bankList}
              contentContainerStyle={styles.bankListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const active = item.code === selectedBankCode;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    style={[
                      styles.bankRow,
                      {
                        backgroundColor: active ? 'rgba(10,132,255,0.08)' : palette.bg,
                        borderColor: active ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <BankLogo
                      name={item.name}
                      bankCode={item.code}
                      slug={item.slug}
                      size={40}
                    />
                    <View style={styles.bankRowCopy}>
                      <Text
                        style={[styles.bankRowName, { color: palette.text }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={[styles.bankRowCode, { color: palette.textSecondary }]}>
                        {item.code}
                      </Text>
                    </View>
                    {active ? (
                      <View style={[styles.checkboxCheck, { backgroundColor: palette.primary }]}>
                        <CheckCircle2 size={16} color="#fff" />
                      </View>
                    ) : (
                      <View style={[styles.checkboxEmpty, { borderColor: palette.border }]} />
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
    gap: Spacing.md,
    maxHeight: '82%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  modalTitle: { fontSize: Typography.lg, fontFamily: Typography.currencySub.fontFamily },
  modalSubtitle: { fontSize: Typography.sm, marginTop: 2, fontFamily: Typography.currencySub.fontFamily },
  modalClose: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  modalCloseText: { fontSize: Typography.sm, fontFamily: Typography.currencySub.fontFamily },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sm,
    padding: 0,
    height: 28,
    fontFamily: Typography.currencySub.fontFamily,
  },
  bankLoading: { paddingVertical: Spacing.xl, alignItems: 'center', justifyContent: 'center' },
  bankList: { flex: 1, minHeight: 160 },
  bankListContent: { paddingBottom: Spacing.md },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 12,
  },
  bankRowCopy: { flex: 1, gap: 2 },
  bankRowName: { fontSize: Typography.sm, fontFamily: Typography.currencySub.fontFamily },
  bankRowCode: { fontSize: 11 },
  checkboxCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
});
