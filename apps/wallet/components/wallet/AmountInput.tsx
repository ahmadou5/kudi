import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, TouchableOpacity } from 'react-native';
import { Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import { useAppPalette } from '../../lib/theme';
import { CustomNumericKeypad } from '../ui/CustomNumericKeypad';

type AmountInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  currencySymbol?: string;
  placeholder?: string;
  helperText?: string;
  presetChips?: Array<{ label: string; amount: number }>;
  onPresetSelect?: (amount: number) => void;
};

export function AmountInput({
  label,
  value,
  onChangeText,
  currencySymbol = '$',
  placeholder = '0.00',
  helperText,
  presetChips,
  onPresetSelect,
}: AmountInputProps) {
  const palette = useAppPalette();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <View
        style={[
          styles.field,
          {
            backgroundColor: palette.card,
            borderColor: focused ? palette.primary : palette.border,
          },
        ]}
      >
        <Text style={[styles.prefix, { color: palette.primary }]}>{currencySymbol}</Text>
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          showSoftInputOnFocus={false}
          placeholder={placeholder}
          placeholderTextColor={palette.textSecondary}
          onFocus={() => setFocused(true)}
          style={[styles.input, { color: palette.text }]}
        />
      </View>

      {presetChips && presetChips.length > 0 ? (
        <View style={styles.presetRow}>
          {presetChips.map((chip) => (
            <TouchableOpacity
              key={chip.label}
              onPress={() => onPresetSelect?.(chip.amount)}
              style={[styles.presetChip, { backgroundColor: palette.bg, borderColor: palette.border }]}
            >
              <Text style={[styles.presetChipText, { color: palette.text }]}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {helperText ? <Text style={[styles.helper, { color: palette.textSecondary }]}>{helperText}</Text> : null}

      {focused && (
        <Modal
          visible={focused}
          transparent
          animationType="slide"
          onRequestClose={() => setFocused(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setFocused(false)} />
            <View style={[styles.keypadSheet, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: palette.text }]}>
                  {label}: {currencySymbol}{value || '0.00'}
                </Text>
                <Pressable onPress={() => setFocused(false)} style={[styles.doneBtn, { backgroundColor: palette.primary }]}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
              </View>
              <CustomNumericKeypad
                onPressDigit={(d) => onChangeText(value + d)}
                onDelete={() => onChangeText(value.slice(0, -1))}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs, marginBottom: Spacing.md },
  label: { fontSize: Typography.sm, fontFamily: Typography.family.semibold },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    minHeight: 56,
  },
  prefix: { fontSize: Typography.xl, fontFamily: Typography.family.bold, marginRight: 8 },
  input: { flex: 1, fontSize: Typography.xl, fontFamily: Typography.family.bold },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetChipText: { fontSize: Typography.xs, fontFamily: Typography.family.bold },
  helper: { fontSize: Typography.xs, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  keypadSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 32,
    gap: Spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  sheetTitle: { fontSize: Typography.md, fontFamily: Typography.family.bold },
  doneBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  doneBtnText: { color: '#fff', fontSize: Typography.sm, fontFamily: Typography.family.bold },
});
