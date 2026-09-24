import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { useAppPalette, isLight } from '../../src/lib/theme';
import { useAuthStore } from '../../src/store/auth.store';
import { Typography } from '../../src/constants/typography';
import { CustomNumericKeypad } from '../../src/components/ui/CustomNumericKeypad';

/**
 * Shared PIN setup / change screen.
 *
 * When navigated to from Security:
 *   - If hasPin === false  →  Create flow: Set → Confirm
 *   - If hasPin === true   →  Change flow: Verify current → Set new → Confirm new
 */

type Step = 'verify_old' | 'enter_new' | 'confirm_new' | 'success';

const STEP_TITLES: Record<Step, string> = {
  verify_old: 'Enter Current PIN',
  enter_new: 'Create New PIN',
  confirm_new: 'Confirm New PIN',
  success: 'PIN Updated!'
};

const STEP_SUBTITLES: Record<Step, string> = {
  verify_old: 'Enter your existing 4-digit PIN to continue',
  enter_new: 'Choose a new 4-digit PIN for your account',
  confirm_new: 'Re-enter your new PIN to confirm',
  success: 'Your PIN has been saved securely'
};

export default function SetPinScreen() {
  const palette = useAppPalette();
  const light = isLight(palette.bg);
  const hasPin = useAuthStore((s) => s.hasPin);
  const verifyPin = useAuthStore((s) => s.verifyPin);
  const setPin = useAuthStore((s) => s.setPin);

  const firstStep: Step = hasPin ? 'verify_old' : 'enter_new';
  const [step, setStep] = useState<Step>(firstStep);
  const [pin, setLocalPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Shake animation for wrong PIN
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true })
    ]).start();
  };

  // Auto-advance when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && !saving) {
      handlePinComplete();
    }
  }, [pin]);

  const handlePinComplete = async () => {
    if (step === 'verify_old') {
      if (verifyPin(pin)) {
        setError(null);
        setLocalPin('');
        setStep('enter_new');
      } else {
        setError('Incorrect PIN. Please try again.');
        shake();
        setLocalPin('');
      }
      return;
    }

    if (step === 'enter_new') {
      setNewPin(pin);
      setLocalPin('');
      setStep('confirm_new');
      return;
    }

    if (step === 'confirm_new') {
      if (pin === newPin) {
        setSaving(true);
        try {
          await setPin(pin);
          setStep('success');
        } catch (e) {
          setError('Failed to save PIN. Please try again.');
          shake();
        } finally {
          setSaving(false);
          setLocalPin('');
        }
      } else {
        setError("PINs don't match. Please try again.");
        shake();
        setLocalPin('');
        // Go back to enter_new
        setTimeout(() => {
          setNewPin('');
          setStep('enter_new');
          setError(null);
        }, 1200);
      }
    }
  };

  const handleDigit = (digit: string) => {
    if (pin.length < 4 && !saving) {
      setLocalPin((p) => p + digit);
      setError(null);
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !saving) {
      setLocalPin((p) => p.slice(0, -1));
    }
  };

  if (step === 'success') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
        <View style={styles.successContainer}>
          <View style={[styles.successIconWrap, { backgroundColor: light ? '#DCFCE7' : 'rgba(16,185,129,0.15)' }]}>
            <ShieldCheck size={52} color="#10B981" />
          </View>
          <Text style={[Typography.title2, { color: palette.text, textAlign: 'center', marginTop: 24 }]}>
            {hasPin ? 'PIN Changed!' : 'PIN Created!'}
          </Text>
          <Text style={[Typography.subhead, { color: palette.textSecondary, textAlign: 'center', marginTop: 8 }]}>
            Your 4-digit PIN has been saved securely on this device.
          </Text>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: palette.primary }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <CheckCircle2 size={20} color="#FFFFFF" />
            <Text style={[Typography.bodyBold, { color: '#FFFFFF' }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const title = STEP_TITLES[step];
  const subtitle = STEP_SUBTITLES[step];

  // Step indicator (only for create: 1/2, or change: 1/2/3)
  const totalSteps = hasPin ? 3 : 2;
  const currentStepIdx = step === 'verify_old' ? 1 : step === 'enter_new' ? (hasPin ? 2 : 1) : (hasPin ? 3 : 2);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>
          {hasPin ? 'Change PIN' : 'Create PIN'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {/* Step indicator pills */}
        <View style={styles.stepRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepPill,
                {
                  backgroundColor: i < currentStepIdx
                    ? palette.primary
                    : (light ? '#E2E8F0' : 'rgba(255,255,255,0.1)')
                }
              ]}
            />
          ))}
        </View>

        {/* Title */}
        <Text style={[Typography.title2, { color: palette.text, textAlign: 'center', marginTop: 32 }]}>
          {title}
        </Text>
        <Text style={[Typography.subhead, { color: palette.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 40 }]}>
          {subtitle}
        </Text>

        {/* PIN dots */}
        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {Array.from({ length: 4 }).map((_, i) => {
            const filled = i < pin.length;
            return (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  {
                    backgroundColor: error
                      ? (filled ? palette.error : 'transparent')
                      : (filled ? palette.primary : 'transparent'),
                    borderColor: error
                      ? palette.error
                      : (filled ? palette.primary : (light ? '#CBD5E1' : 'rgba(255,255,255,0.2)'))
                  }
                ]}
              />
            );
          })}
        </Animated.View>

        {/* Error */}
        {error ? (
          <Text style={[styles.errorText, { color: palette.error }]}>{error}</Text>
        ) : (
          <View style={{ height: 20 }} />
        )}

        {saving && <ActivityIndicator color={palette.primary} style={{ marginBottom: 12 }} />}

        {/* Keypad */}
        <CustomNumericKeypad
          onPressDigit={handleDigit}
          onDelete={handleDelete}
          disabled={saving}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    alignItems: 'center'
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8
  },
  stepPill: {
    height: 4,
    borderRadius: 2,
    flex: 1
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40
  },
  successIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 40,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    width: '100%'
  }
});
