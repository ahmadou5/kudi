import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { BankLogo, BankItem } from './BankPickerModal';
import { ChainLogo } from '../ui/ChainLogo';

export interface Beneficiary {
  id: string;
  name: string;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  handle?: string;
  address?: string;
  chain?: 'solana' | 'monad';
  type: 'BANK' | 'INTERAPP' | 'CRYPTO';
}

interface BeneficiariesScrollProps {
  beneficiaries: Beneficiary[];
  onSelect: (beneficiary: Beneficiary) => void;
  onLongPress: (id: string, name: string) => void;
}

function initialsFromName(name?: string) {
  if (!name) return 'P';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export const BeneficiariesScroll: React.FC<BeneficiariesScrollProps> = ({
  beneficiaries,
  onSelect,
  onLongPress,
}) => {
  const palette = useAppPalette();

  if (beneficiaries.length === 0) return null;

  return (
    <View style={styles.beneficiariesSection}>
      <Text style={[styles.beneficiariesTitle, { color: palette.textSecondary }]}>
        Saved Beneficiaries
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.beneficiariesScroll}>
        {beneficiaries.map((b) => (
          <TouchableOpacity
            key={b.id}
            onPress={() => onSelect(b)}
            onLongPress={() => onLongPress(b.id, b.name)}
            style={styles.beneficiaryAvatarCard}
          >
            {b.type === 'BANK' ? (
              <BankLogo name={b.bankName || b.name} bankCode={b.bankCode} size={44} />
            ) : b.type === 'CRYPTO' ? (
              <View style={[styles.avatarCircle, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                <ChainLogo chain={b.chain || 'solana'} size={24} />
              </View>
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                <Text style={[styles.avatarText, { color: palette.text }]}>{initialsFromName(b.name)}</Text>
              </View>
            )}
            <Text style={[styles.beneficiaryName, { color: palette.text }]} numberOfLines={1}>
              {b.name.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  beneficiariesSection: { gap: 8 },
  beneficiariesTitle: { fontSize: Typography.xs, fontFamily: Typography.family.bold, letterSpacing: 0.8 },
  beneficiariesScroll: { gap: 12, paddingVertical: 4 },
  beneficiaryAvatarCard: { alignItems: 'center', gap: 4, width: 64 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: Typography.sm, fontFamily: Typography.family.bold },
  beneficiaryName: { fontSize: Typography.xs, fontFamily: Typography.family.medium, textAlign: 'center' },
});
