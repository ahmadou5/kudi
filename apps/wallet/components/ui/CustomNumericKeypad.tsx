import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useAppPalette } from '../../lib/theme';

export interface CustomNumericKeypadProps {
  onPressDigit: (digit: string) => void;
  onDelete: () => void;
  onBiometricPress?: () => void;
  disabled?: boolean;
}

export const CustomNumericKeypad: React.FC<CustomNumericKeypadProps> = ({
  onPressDigit,
  onDelete,
  onBiometricPress,
  disabled = false
}) => {
  const palette = useAppPalette();

  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['BIO', '0', 'DEL']
  ];

  return (
    <View style={styles.container}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((item) => {
            if (item === 'BIO') {
              return (
                <TouchableOpacity
                  key="bio"
                  disabled={disabled}
                  onPress={onBiometricPress}
                  style={[styles.keyButton, { backgroundColor: palette.card, borderColor: palette.border }]}
                >
                  <Text style={{ fontSize: 20 }}>👆</Text>
                </TouchableOpacity>
              );
            }

            if (item === 'DEL') {
              return (
                <TouchableOpacity
                  key="del"
                  disabled={disabled}
                  onPress={onDelete}
                  style={[styles.keyButton, { backgroundColor: palette.card, borderColor: palette.border }]}
                >
                  <Text style={[styles.delText, { color: palette.text }]}>⌫</Text>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={item}
                disabled={disabled}
                onPress={() => onPressDigit(item)}
                style={[styles.keyButton, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <Text style={[styles.digitText, { color: palette.text }]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    gap: 14
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16
  },
  keyButton: {
    flex: 1,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  digitText: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  delText: {
    fontSize: 20,
    fontWeight: '700'
  }
});
