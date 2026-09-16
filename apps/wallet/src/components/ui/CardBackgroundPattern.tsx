import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppPalette } from '../../lib/theme';

interface CardBackgroundPatternProps {
  glowColor?: string;
  isDarkOverride?: boolean;
}

export const CardBackgroundPattern: React.FC<CardBackgroundPatternProps> = ({
  glowColor,
  isDarkOverride,
}) => {
  const palette = useAppPalette();
  const isDark = isDarkOverride !== undefined ? isDarkOverride : palette.text === '#FFFFFF';

  const defaultGlow = isDark ? 'rgba(52, 211, 153, 0.05)' : 'rgba(16, 185, 129, 0.04)';

  return (
    <View style={styles.patternContainer} pointerEvents="none">
      <View
        style={[
          styles.patternRingOuter,
          { borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)' }
        ]}
      />
      <View
        style={[
          styles.patternRingInner,
          { borderColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.04)' }
        ]}
      />
      <View
        style={[
          styles.patternGlow,
          { backgroundColor: glowColor || defaultGlow }
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  patternContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    borderRadius: 24,
  },
  patternRingOuter: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
  },
  patternRingInner: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
  },
  patternGlow: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
});
