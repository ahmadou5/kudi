import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';

export default function CardTab() {
  const palette = useAppPalette();
  const [selectedCard, setSelectedCard] = useState<0 | 1>(0);

  // Standard React Native Animated values
  const floatY = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  // Continuous floating animation
  useEffect(() => {
    const floatAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -8,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    floatAnim.start();
    return () => floatAnim.stop();
  }, [floatY]);

  // Handle card switch animation trigger
  const handleSelectCard = (idx: 0 | 1) => {
    if (selectedCard === idx) return;

    cardScale.setValue(0.9);
    cardOpacity.setValue(0.6);

    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();

    setSelectedCard(idx);
  };

  const cards = [
    {
      id: 'usd',
      name: 'Kudi USD Virtual Card',
      brand: 'VISA',
      currency: 'USD (USDC)',
      number: '•••• •••• •••• 5678',
      expires: '08/28',
      type: 'Visa Debit',
      bgDark: '#1E293B',
      bgLight: '#F1F5F9',
      accentColor: '#34D399'
    },
    {
      id: 'ngn',
      name: 'Kudi NGN Virtual Card',
      brand: 'Mastercard',
      currency: 'NGN Float',
      number: '•••• •••• •••• 9012',
      expires: '12/28',
      type: 'Mastercard',
      bgDark: '#0F172A',
      bgLight: '#E2E8F0',
      accentColor: '#60A5FA'
    }
  ];

  const currentCard = cards[selectedCard];
  const isDark = palette.text === '#FFFFFF';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Title & Coming Soon Pill */}
      <View style={styles.headerRow}>
        <Text style={[Typography.title1, { color: palette.text }]}>Cards</Text>
      </View>

      {/* Card Selector Tabs */}
      <View style={styles.cardSelectorRow}>
        {cards.map((card, idx) => (
          <TouchableOpacity
            key={card.id}
            onPress={() => handleSelectCard(idx as 0 | 1)}
            activeOpacity={0.8}
            style={[
              styles.cardSelectTab,
              {
                backgroundColor: selectedCard === idx
                  ? (isDark ? 'rgba(255, 255, 255, 0.15)' : '#0F172A')
                  : palette.card,
                borderColor: palette.border
              }
            ]}
          >
            <Text
              style={[
                Typography.footnote,
                {
                  color: selectedCard === idx ? '#FFFFFF' : palette.textSecondary,
                  fontWeight: selectedCard === idx ? '700' : '500'
                }
              ]}
            >
              {card.id.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Animated Floating Virtual Card Graphic */}
      <View style={styles.cardsWrapper}>
        <Animated.View
          style={[
            styles.metallicCard,
            {
              transform: [
                { translateY: floatY },
                { scale: cardScale }
              ],
              opacity: cardOpacity,
              backgroundColor: isDark ? currentCard.bgDark : currentCard.bgLight,
              borderColor: currentCard.accentColor,
              borderWidth: 1.5
            }
          ]}
        >
          {/* Subtle Background Pattern Layer */}
          <View style={styles.patternContainer} pointerEvents="none">
            <View
              style={[
                styles.patternRingOuter,
                { borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)' }
              ]}
            />
            <View
              style={[
                styles.patternRingInner,
                { borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)' }
              ]}
            />
            <View
              style={[
                styles.patternGlow,
                { backgroundColor: currentCard.accentColor, opacity: 0.1 }
              ]}
            />
            <View style={styles.dotGrid}>
              {[...Array(6)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.patternDot,
                    { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.15)' }
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.cardTopRow}>
            <View style={styles.brandGroup}>
              <Text style={[Typography.title2, { color: palette.text, fontWeight: '800' }]}>Kudi</Text>

            </View>
            <Text style={[Typography.title2, { color: palette.text, fontStyle: 'italic', fontWeight: '900' }]}>
              {currentCard.brand}
            </Text>
          </View>

          <View style={styles.cardChipRow}>
            <View style={[styles.cardChip, { backgroundColor: isDark ? '#475569' : '#CBD5E1' }]}>
              <View style={[styles.chipLine, { backgroundColor: isDark ? '#334155' : '#94A3B8' }]} />
            </View>
            <Ionicons name="wifi-outline" size={24} color={palette.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
          </View>

          <View style={styles.cardBottomRow}>
            <Text style={[Typography.currencyDisplay, { color: palette.text, fontSize: 20, letterSpacing: 2 }]}>
              {currentCard.number}
            </Text>

            <View style={styles.cardMetaRow}>
              <View>
                <Text style={[Typography.caption, { color: palette.textSecondary }]}>EXPIRES</Text>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>{currentCard.expires}</Text>
              </View>
              <View>
                <Text style={[Typography.caption, { color: palette.textSecondary }]}>CURRENCY</Text>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>{currentCard.id.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Minimal Coming Soon Center Text */}
      <View style={styles.comingSoonCenter}>
        <Ionicons name="time-outline" size={22} color={palette.textSecondary} />
        <Text style={[Typography.bodyBold, { color: palette.textSecondary, marginTop: 6 }]}>
          Virtual Cards Coming Soon
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    alignItems: 'stretch'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1
  },
  cardSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24
  },
  cardSelectTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 39,
    borderWidth: 1
  },
  cardsWrapper: {
    alignItems: 'center',
    marginVertical: 10
  },
  metallicCard: {
    width: '100%',
    borderRadius: 22,
    padding: 22,
    height: 205,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8
  },
  patternContainer: { ...(StyleSheet.absoluteFill as any) },
  patternRingOuter: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5
  },
  patternRingInner: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1
  },
  patternGlow: {
    position: 'absolute',
    top: -30,
    right: 10,
    width: 150,
    height: 150,
    borderRadius: 75
  },
  dotGrid: {
    position: 'absolute',
    top: 18,
    right: 20,
    flexDirection: 'row',
    gap: 6
  },
  patternDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  cardChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12
  },
  cardChip: {
    width: 38,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  chipLine: {
    height: 1,
    width: '100%'
  },
  cardBottomRow: {
    marginTop: 'auto'
  },
  cardMetaRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 10
  },
  comingSoonCenter: {
    marginTop: 176,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

