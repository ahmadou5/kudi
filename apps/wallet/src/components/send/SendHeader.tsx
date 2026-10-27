import React from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { haptics } from '../../lib/haptics';

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
      <Pressable
        onPress={() => {
          haptics.tap();
          onBack();
        }}
        style={({ pressed }) => [
          styles.backButton,
          { backgroundColor: palette.card, borderColor: palette.border },
          pressed && { opacity: 0.6 }
        ]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ArrowLeft size={24} color={palette.text} />
      </Pressable>

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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'

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
