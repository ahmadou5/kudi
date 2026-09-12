import React, { ReactNode, useState, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomNumericKeypad } from '../ui/CustomNumericKeypad';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

type PaymentPinModalProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  reviewLabel?: string;
  reviewTitle?: string;
  reviewMeta?: string;
  reviewAmount?: string;
  showReviewCard?: boolean;
  pin?: string;
  onPinChange?: (value: string) => void;
  loading?: boolean;
  error?: string;
  confirmLabel?: string;
  onConfirm?: (pin: string) => void;
  onClose: () => void;
  canClose?: boolean;
  footerHint?: ReactNode;
  onBiometricPress?: () => void;
};

export function PaymentPinModal({
  visible,
  title = 'Security PIN',
  subtitle = 'Enter your 4-digit transaction PIN to continue',
  reviewLabel = 'Transaction',
  reviewTitle = 'Confirm Payment',
  reviewMeta,
  reviewAmount = '—',
  showReviewCard = true,
  pin: controlledPin,
  onPinChange: controlledOnPinChange,
  loading = false,
  error,
  confirmLabel = 'Confirm Transaction',
  onConfirm,
  onClose,
  canClose = true,
  footerHint,
  onBiometricPress,
}: PaymentPinModalProps) {
  const palette = useAppPalette();
  const [internalPin, setInternalPin] = useState('');

  useEffect(() => {
    if (!visible) {
      setInternalPin('');
    }
  }, [visible]);

  const effectivePin = controlledPin !== undefined ? controlledPin : internalPin;

  const setPin = (val: string) => {
    if (controlledOnPinChange) {
      controlledOnPinChange(val);
    } else {
      setInternalPin(val);
    }
  };

  const currentPin = effectivePin ?? '';
  const canSubmit = currentPin.length >= 4 && !loading;

  const handleDigitPress = (digit: string) => {
    if (currentPin.length < 4 && !loading) {
      setPin(currentPin + digit);
    }
  };

  const handleDeletePress = () => {
    if (currentPin.length > 0 && !loading) {
      setPin(currentPin.slice(0, -1));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!canClose || loading) return;
        onClose();
      }}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (!canClose || loading) return;
            onClose();
          }}
        />
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
            </View>
            <Pressable
              onPress={() => {
                if (!canClose || loading) return;
                onClose();
              }}
              style={[styles.closeButton, { backgroundColor: palette.bg }]}
            >
              <Text style={[styles.closeText, { color: palette.text }]}>Close</Text>
            </Pressable>
          </View>

          {showReviewCard ? (
            <View style={[styles.reviewCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Text style={[styles.reviewLabel, { color: palette.textSecondary }]}>{reviewLabel}</Text>
              <Text style={[styles.reviewTitle, { color: palette.text }]}>{reviewTitle}</Text>
              {reviewMeta ? <Text style={[styles.reviewMeta, { color: palette.textSecondary }]}>{reviewMeta}</Text> : null}
              <View style={[styles.reviewAmountBox, { borderColor: palette.border }]}>
                <Text style={[styles.reviewAmountLabel, { color: palette.textSecondary }]}>Amount</Text>
                <Text style={[styles.reviewAmountValue, { color: palette.text }]}>{reviewAmount}</Text>
              </View>
            </View>
          ) : null}

          {/* 4 Pin Dots indicator */}
          <View style={styles.pinDotsContainer}>
            {Array.from({ length: 4 }).map((_, index) => {
              const filled = index < currentPin.length;
              return (
                <View
                  key={index}
                  style={[
                    styles.pinDot,
                    {
                      backgroundColor: filled ? palette.primary : palette.bg,
                      borderColor: filled ? palette.primary : palette.border,
                    },
                  ]}
                />
              );
            })}
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: palette.error }]}>{error}</Text>
          ) : null}

          <CustomNumericKeypad
            onPressDigit={handleDigitPress}
            onDelete={handleDeletePress}
            disabled={loading}
            onBiometricPress={onBiometricPress}
          />

          {footerHint ? footerHint : null}

          <Pressable
            onPress={() => {
              onConfirm?.(currentPin);
            }}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.confirmButton,
              { backgroundColor: palette.primary, opacity: canSubmit ? (pressed ? 0.92 : 1) : 0.45 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={palette.card} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={palette.card} />
                <Text style={[styles.confirmText, { color: palette.card }]}>{confirmLabel}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: Typography.lg,
    fontFamily: Typography.family.bold,
  },
  subtitle: {
    marginTop: 2,
    fontSize: Typography.sm,
  },
  closeButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  closeText: {
    fontSize: Typography.sm,
    fontFamily: Typography.family.bold,
  },
  reviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  reviewLabel: {
    fontSize: Typography.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: Typography.family.bold,
  },
  reviewTitle: {
    fontSize: Typography.md,
    fontFamily: Typography.family.bold,
  },
  reviewMeta: {
    fontSize: Typography.xs,
  },
  reviewAmountBox: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  reviewAmountLabel: {
    fontSize: Typography.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: Typography.family.bold,
  },
  reviewAmountValue: {
    fontSize: 24,
    fontFamily: Typography.family.bold,
    marginTop: 2,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 8,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  errorText: {
    textAlign: 'center',
    fontSize: Typography.xs,
    fontFamily: Typography.family.semibold,
  },
  confirmButton: {
    flexDirection: 'row',
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmText: {
    fontSize: Typography.md,
    fontFamily: Typography.family.bold,
  },
});
