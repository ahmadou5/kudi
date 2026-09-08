import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export type ChainId = 'solana' | 'monad' | 'ethereum' | 'polygon' | 'arbitrum';

interface ChainLogoProps {
  chain: ChainId | string;
  size?: number;
}

export const ChainLogo: React.FC<ChainLogoProps> = ({ chain, size = 20 }) => {
  const normalized = chain.toLowerCase();

  if (normalized.includes('solana') || normalized.includes('sol')) {
    return (
      <Image
        source={require('../../assets/logos/solana.png')}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="contain"
      />
    );
  }

  if (normalized.includes('monad')) {
    return (
      <View
        style={[
          styles.monadBadge,
          { width: size, height: size, borderRadius: size / 2 }
        ]}
      >
        <Text style={[styles.monadLetter, { fontSize: Math.max(9, size * 0.55) }]}>M</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallbackBadge,
        { width: size, height: size, borderRadius: size / 2 }
      ]}
    >
      <Text style={[styles.fallbackLetter, { fontSize: Math.max(9, size * 0.5) }]}>⚡</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  monadBadge: {
    backgroundColor: '#836EF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#9945FF'
  },
  monadLetter: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  fallbackBadge: {
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  fallbackLetter: {
    color: '#FFFFFF',
    fontWeight: '700'
  }
});
