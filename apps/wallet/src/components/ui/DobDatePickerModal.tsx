import React, { useMemo, useState, useEffect } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import { hexToRgba, useAppPalette } from '../../lib/theme';

type DobDatePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (dateString: string) => void;
  initialValue?: string; // YYYY-MM-DD
};

const MONTHS = [
  { label: 'Jan', value: 1 },
  { label: 'Feb', value: 2 },
  { label: 'Mar', value: 3 },
  { label: 'Apr', value: 4 },
  { label: 'May', value: 5 },
  { label: 'Jun', value: 6 },
  { label: 'Jul', value: 7 },
  { label: 'Aug', value: 8 },
  { label: 'Sep', value: 9 },
  { label: 'Oct', value: 10 },
  { label: 'Nov', value: 11 },
  { label: 'Dec', value: 12 },
];

export function DobDatePickerModal({
  visible,
  onClose,
  onSelect,
  initialValue,
}: DobDatePickerModalProps) {
  const palette = useAppPalette();
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - 18; // Must be 18+

  // Generate year list (from maxYear down to 1930)
  const years = useMemo(() => {
    const arr = [];
    for (let y = maxYear; y >= 1930; y--) {
      arr.push(y);
    }
    return arr;
  }, [maxYear]);

  // Generate day list (1 to 31)
  const days = useMemo(() => {
    const arr = [];
    for (let d = 1; d <= 31; d++) {
      arr.push(d);
    }
    return arr;
  }, []);

  // Selected values states
  const [selectedYear, setSelectedYear] = useState(maxYear);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);

  // Parse initial value if present
  useEffect(() => {
    if (initialValue && /^\d{4}-\d{2}-\d{2}$/.test(initialValue)) {
      const parts = initialValue.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (y <= maxYear && y >= 1930) setSelectedYear(y);
      if (m >= 1 && m <= 12) setSelectedMonth(m);
      if (d >= 1 && d <= 31) setSelectedDay(d);
    }
  }, [initialValue, visible, maxYear]);

  const handleConfirm = () => {
    const pad = (num: number) => String(num).padStart(2, '0');
    // Enforce valid day of month (e.g. Feb 30 -> Feb 28/29)
    let finalDay = selectedDay;
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    if (finalDay > daysInMonth) {
      finalDay = daysInMonth;
    }
    const dobString = `${selectedYear}-${pad(selectedMonth)}-${pad(finalDay)}`;
    onSelect(dobString);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: palette.card, borderColor: palette.border }]}>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={[styles.btnText, { color: palette.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.title, { color: palette.text }]}>Date of Birth</Text>
            <Pressable onPress={handleConfirm} hitSlop={12}>
              <Text style={[styles.btnText, { color: palette.primary, fontFamily: Typography.family.bold }]}>Done</Text>
            </Pressable>
          </View>

          {/* Scroller Area */}
          <View style={styles.pickerContainer}>

            {/* Day Column */}
            <View style={styles.column}>
              <Text style={[styles.columnLabel, { color: palette.textSecondary }]}>Day</Text>
              <FlatList
                data={days}
                keyExtractor={(item) => String(item)}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const active = item === selectedDay;
                  return (
                    <Pressable
                      onPress={() => setSelectedDay(item)}
                      style={[
                        styles.itemRow,
                        active && { backgroundColor: hexToRgba(palette.primary, 0.14), borderRadius: 10 }
                      ]}
                    >
                      <Text style={[styles.itemText, { color: active ? palette.primary : palette.text }, active && { fontFamily: Typography.family.bold }]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                }}
                style={styles.list}
              />
            </View>

            {/* Month Column */}
            <View style={styles.column}>
              <Text style={[styles.columnLabel, { color: palette.textSecondary }]}>Month</Text>
              <FlatList
                data={MONTHS}
                keyExtractor={(item) => String(item.value)}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const active = item.value === selectedMonth;
                  return (
                    <Pressable
                      onPress={() => setSelectedMonth(item.value)}
                      style={[
                        styles.itemRow,
                        active && { backgroundColor: hexToRgba(palette.primary, 0.14), borderRadius: 10 }
                      ]}
                    >
                      <Text style={[styles.itemText, { color: active ? palette.primary : palette.text }, active && { fontFamily: Typography.family.bold }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                }}
                style={styles.list}
              />
            </View>

            {/* Year Column */}
            <View style={styles.column}>
              <Text style={[styles.columnLabel, { color: palette.textSecondary }]}>Year</Text>
              <FlatList
                data={years}
                keyExtractor={(item) => String(item)}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const active = item === selectedYear;
                  return (
                    <Pressable
                      onPress={() => setSelectedYear(item)}
                      style={[
                        styles.itemRow,
                        active && { backgroundColor: hexToRgba(palette.primary, 0.14), borderRadius: 10 }
                      ]}
                    >
                      <Text style={[styles.itemText, { color: active ? palette.primary : palette.text }, active && { fontFamily: Typography.family.bold }]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                }}
                style={styles.list}
              />
            </View>

          </View>

          <Text style={[styles.helper, { color: palette.textSecondary }]}>
            Enforcing age limit. Must be born on or before {maxYear}.
          </Text>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: Typography.md, fontFamily: Typography.family.bold },
  btnText: { fontSize: Typography.sm },
  pickerContainer: { flexDirection: 'row', gap: Spacing.md, height: 220, marginVertical: 10 },
  column: { flex: 1, alignItems: 'stretch' },
  columnLabel: { fontSize: Typography.xs, fontFamily: Typography.family.bold, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center', marginBottom: 8 },
  list: { flex: 1 },
  itemRow: { height: 40, alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
  itemText: { fontSize: Typography.md },
  helper: { fontSize: 11, textAlign: 'center', marginTop: 4 },
});
