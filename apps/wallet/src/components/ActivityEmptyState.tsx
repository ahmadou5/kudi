import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppPalette, hexToRgba } from '../lib/theme';
import { Typography } from '../constants/typography';
import { ActivityEmptyVisual } from './ActivityEmptyVisual';

interface ActivityEmptyStateProps {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function ActivityEmptyState({
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary
}: ActivityEmptyStateProps) {
  const palette = useAppPalette();

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <ActivityEmptyVisual />

      <Text style={[Typography.title3, styles.title, { color: palette.text }]}>{title}</Text>
      <Text style={[Typography.subhead, styles.body, { color: hexToRgba(palette.text, 0.55) }]}>
        {body}
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={onPrimary}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: palette.text, borderColor: palette.border },
            pressed && { opacity: 0.85 }
          ]}
        >
          <Text style={[Typography.bodyBold, { color: palette.bg }]}>
            {primaryLabel}
          </Text>
        </Pressable>

        {onSecondary && secondaryLabel && (
          <Pressable
            onPress={onSecondary}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: palette.card, borderColor: palette.border },
              pressed && { opacity: 0.7 }
            ]}
          >
            <Text style={[Typography.bodyBold, { color: palette.text }]}>
              {secondaryLabel}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 300,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 22,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    marginTop: 20,
    textAlign: 'center'
  },
  body: {
    marginTop: 6,
    maxWidth: 260,
    textAlign: 'center'
  },
  actions: {
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

});
