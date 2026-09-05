import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export interface CustomNumericKeypadProps {
  onPressDigit: (digit: string) => void;
  onDelete: () => void;
  onBiometricPress?: () => void;
  disabled?: boolean;
  mode?: 'light' | 'dark';
}

export const CustomNumericKeypad: React.FC<CustomNumericKeypadProps> = ({
  onPressDigit,
  onDelete,
  onBiometricPress,
  disabled = false,
  mode = 'dark'
}) => {
  const isLight = mode === 'light';

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
                  style={[
                    styles.keyButton,
                    {
                      backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
                      borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.1)'
                    }
                  ]}
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
                  style={[
                    styles.keyButton,
                    {
                      backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
                      borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.1)'
                    }
                  ]}
                >
                  <Text style={[styles.delText, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
                    ⌫
                  </Text>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={item}
                disabled={disabled}
                onPress={() => onPressDigit(item)}
                style={[
                  styles.keyButton,
                  {
                    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                    borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.12)'
                  }
                ]}
              >
                <Text style={[styles.digitText, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
                  {item}
                </Text>
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
