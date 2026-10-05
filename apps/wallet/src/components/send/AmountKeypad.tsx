import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Delete } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppPalette } from '../../lib/theme';

interface AmountKeypadProps {
  onDigit: (digit: string) => void;
  onDot: () => void;
  onBackspace: () => void;
}

const ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'DEL'],
];

/** Borderless 12-key amount pad (digits, decimal point, backspace). */
export const AmountKeypad: React.FC<AmountKeypadProps> = ({ onDigit, onDot, onBackspace }) => {
  const palette = useAppPalette();

  const press = (key: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (key === 'DEL') onBackspace();
    else if (key === '.') onDot();
    else onDigit(key);
  };

  return (
    <View style={styles.container}>
      {ROWS.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={styles.key}
              activeOpacity={0.5}
              onPress={() => press(key)}
              accessibilityLabel={key === 'DEL' ? 'Delete' : key === '.' ? 'Decimal point' : key}
            >
              {key === 'DEL' ? (
                <Delete size={26} color={palette.text} />
              ) : (
                <Text style={[styles.keyText, { color: palette.text }]}>{key}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', paddingHorizontal: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  key: {
    flex: 1,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '500',
  },
});
