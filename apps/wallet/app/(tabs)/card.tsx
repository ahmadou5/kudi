import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Animated, Easing } from 'react-native';
import { Wifi, Clock, Sparkles, ShieldCheck, Zap } from 'lucide-react-native';
import { useAppPalette } from '../../src/lib/theme';
import { Typography } from '../../src/constants/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function AnimatedStackedCards({ activeTab }: { activeTab: 0 | 1 }) {
  const floatY1 = useRef(new Animated.Value(0)).current;
  const floatY2 = useRef(new Animated.Value(0)).current;
  const swapAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY1, {
          toValue: -8,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(floatY1, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );

    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY2, {
          toValue: 5,
          duration: 2900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(floatY2, {
          toValue: -3,
          duration: 2900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );

    anim1.start();
    anim2.start();

    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, [floatY1, floatY2]);

  useEffect(() => {
    Animated.spring(swapAnim, {
      toValue: activeTab,
      friction: 6,
      tension: 90,
      useNativeDriver: true
    }).start();
  }, [activeTab, swapAnim]);

  // Interpolations for smooth card swap
  const topCardTranslateX = swapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16]
  });
  const topCardTranslateY = swapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18]
  });
  const topCardRotate = swapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-1.5deg', '-7deg']
  });
  const topCardZIndex = activeTab === 0 ? 2 : 1;

  const bottomCardTranslateX = swapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0]
  });
  const bottomCardTranslateY = swapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0]
  });
  const bottomCardRotate = swapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-7deg', '-1.5deg']
  });
  const bottomCardZIndex = activeTab === 1 ? 2 : 1;

  return (
    <View style={styles.stackedCardsContainer}>
      {/* Black / NGN Card */}
      <Animated.View
        style={[
          styles.cardBase,
          styles.blackCard,
          {
            zIndex: bottomCardZIndex,
            transform: [
              { translateY: floatY2 },
              { translateX: bottomCardTranslateX },
              { translateY: bottomCardTranslateY },
              { rotate: bottomCardRotate }
            ]
          }
        ]}
      >
        <View style={styles.cardPatternCircle} />
        <View style={styles.cardPatternCircle2} />
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[Typography.bodyBold, { color: '#FFFFFF', fontWeight: '800' }]}>KUDI</Text>
            <View style={[styles.emvChip, styles.silverChip, { marginLeft: 10 }]} />
          </View>
          <Wifi size={18} color="#64748B" style={{ transform: [{ rotate: '90deg' }] }} />
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.blackCardNumber}>•••• •••• •••• 9012</Text>
            <Text style={[Typography.caption, { color: '#64748B', marginTop: 2 }]}>NGN</Text>
          </View>
          <Text style={styles.visaTextDark}>VISA</Text>
        </View>
      </Animated.View>

      {/* Silver / USD Card */}
      <Animated.View
        style={[
          styles.cardBase,
          styles.silverCard,
          {
            zIndex: topCardZIndex,
            transform: [
              { translateY: floatY1 },
              { translateX: topCardTranslateX },
              { translateY: topCardTranslateY },
              { rotate: topCardRotate }
            ]
          }
        ]}
      >
        <View style={styles.silverShineOverlay} />
        <View style={styles.silverPatternCircle} />
        <View style={styles.silverPatternCircle2} />
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[Typography.bodyBold, { color: '#0F172A', fontWeight: '800' }]}>KUDI</Text>
            <View style={[styles.emvChip, styles.silverChip, { marginLeft: 10 }]} />
          </View>
          <Wifi size={18} color="#475569" style={{ transform: [{ rotate: '90deg' }] }} />
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.silverCardNumber}>•••• •••• •••• 5678</Text>
            <Text style={[Typography.caption, { color: '#475569', marginTop: 2 }]}>USD</Text>
          </View>
          <Text style={styles.visaTextLight}>VISA</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function CardTab() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const [selectedCard, setSelectedCard] = useState<0 | 1>(0);
  const isDark = palette.text === '#FFFFFF';

  const cards = [
    { id: 'usd', label: 'USD CARD' },
    { id: 'ngn', label: 'NGN CARD' }
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Title */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[Typography.title1, { color: palette.text }]}>Cards</Text>

        </View>
      </View>

      {/* Card Selector Tabs */}
      <View style={styles.cardSelectorRow}>
        {cards.map((card, idx) => (
          <TouchableOpacity
            key={card.id}
            onPress={() => setSelectedCard(idx as 0 | 1)}
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
              {card.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Onboarding-Style Animated Stacked Cards Visual */}
      <View style={[styles.cardsWrapper, { marginTop: insets.top }]}>
        <AnimatedStackedCards activeTab={selectedCard} />
      </View>

      {/* Coming Soon Center Banner */}
      <View style={[styles.comingSoonBanner, { marginTop: insets.top }]}>
        <Clock size={20} color={palette.textSecondary} />
        <Text style={[Typography.currencyDisplay, { color: palette.text, marginTop: 8, textAlign: 'center' }]}>
          Cards are Coming Soon!
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
  cardSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24
  },
  cardSelectTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1
  },
  cardsWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 260,
    marginVertical: 10,
    marginBottom: 30
  },
  stackedCardsContainer: {
    width: 290,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  cardBase: {
    width: 280,
    height: 168,
    borderRadius: 20,
    padding: 18,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
    overflow: 'hidden',
    position: 'absolute'
  },
  silverCard: {
    backgroundColor: '#E2E8F0',
    borderColor: '#FFFFFF',
    borderWidth: 1.5
  },
  blackCard: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1.5
  },
  silverShineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    transform: [{ skewY: '-8deg' }],
    marginTop: -15
  },
  silverPatternCircle: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)'
  },
  silverPatternCircle2: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)'
  },
  cardPatternCircle: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  cardPatternCircle2: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  emvChip: {
    width: 36,
    height: 24,
    borderRadius: 6,
    borderWidth: 1
  },
  silverChip: {
    backgroundColor: '#CBD5E1',
    borderColor: '#94A3B8'
  },
  goldChip: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B'
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  silverCardNumber: {
    fontFamily: Typography.family.mono,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    letterSpacing: 1
  },
  blackCardNumber: {
    fontFamily: Typography.family.mono,
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 1
  },
  visaTextLight: {
    fontFamily: Typography.family.sans,
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#0F172A',
    letterSpacing: 1
  },
  visaTextDark: {
    fontFamily: Typography.family.sans,
    fontSize: 16,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
    letterSpacing: 1
  },
  comingSoonBanner: {
    borderRadius: 20,

    padding: 20,
    alignItems: 'center',
    marginVertical: 16
  },
  featuresCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  }
});
