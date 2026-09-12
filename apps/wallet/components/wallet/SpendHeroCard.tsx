import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Banknote } from 'lucide-react-native';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { FlowProgressDots } from './WalletFlowProgress';

interface SpendHeroCardProps {
  activeFlowTitle: string;
  currentStep: number;
  totalSteps?: number;
  onStepPress?: (step: number) => void;
}

export const SpendHeroCard: React.FC<SpendHeroCardProps> = ({
  activeFlowTitle,
  currentStep,
  totalSteps = 3,
  onStepPress,
}) => {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';

  return (
    <View style={[styles.heroCard, { backgroundColor: isDark ? '#06101E' : '#0F172A' }]}>
      <View style={styles.heroTop}>
        <View>
          <Text style={styles.heroLabel}>Active flow</Text>
          <Text style={styles.heroValue}>{activeFlowTitle}</Text>
        </View>
        <View style={styles.heroIcon}>
          <Banknote size={20} color="#fff" />
        </View>
      </View>

      <FlowProgressDots
        currentStep={currentStep}
        totalSteps={totalSteps}
        onStepPress={onStepPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 24,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.xs },
  heroValue: { color: '#fff', fontSize: Typography.lg, fontFamily: Typography.family.bold },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
