import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';

interface SendHeaderProps {
  title: string;
  onBack: () => void;
  /** Optional element shown left of the title (e.g. token logo). */
  leading?: React.ReactNode;
}

export const SendHeader: React.FC<SendHeaderProps> = ({ title, onBack, leading }) => {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ArrowLeft size={24} color={palette.text} />
      </TouchableOpacity>

      <View style={styles.titleWrap} pointerEvents="none">
        {leading}
        <Text style={[Typography.title3, styles.title, { color: palette.text }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    minHeight: 56,
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    bottom: 12,
    zIndex: 2,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  title: { fontWeight: '600' },
});
