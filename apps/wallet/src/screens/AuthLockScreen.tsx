import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { CustomNumericKeypad } from '../components/CustomNumericKeypad';
import { useAuthStore } from '../../store/auth.store';

interface AuthLockScreenProps {
  mode?: 'light' | 'dark';
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({ mode = 'dark' }) => {
  const isLight = mode === 'light';
  const { user, unlock, logout, verifyPin } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'K';

  const handleDigitPress = (digit: string) => {
    if (pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);

    if (nextPin.length === 4) {
      if (verifyPin(nextPin)) {
        unlock();
      } else {
        setError('Incorrect PIN. Try 1234');
        setPin('');
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin((prev) => prev.slice(0, -1));
      setError(null);
    }
  };

  const handleBiometricPress = () => {
    // Biometric fingerprint trigger (LocalAuthentication simulated)
    Alert.alert(
      'Fingerprint Biometric Unlock',
      'Scanning fingerprint for Kudi Wallet...',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Authenticate',
          onPress: () => unlock()
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isLight ? '#FFFFFF' : '#090A0F' }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => logout()}>
          <Text style={[styles.logoutText, { color: isLight ? '#EF4444' : '#F87171' }]}>
            Log out
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.helpPill,
            {
              backgroundColor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.1)',
              borderColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)'
            }
          ]}
        >
          <Text style={[styles.helpText, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
            🎧 Help
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Unlock Section */}
      <View style={styles.centerSection}>
        <View style={[styles.avatarCircle, { backgroundColor: isLight ? '#0F172A' : '#CBD5E1' }]}>
          <Text style={[styles.avatarInitials, { color: isLight ? '#FFFFFF' : '#0F172A' }]}>
            {initials}
          </Text>
        </View>

        <Text style={[styles.welcomeTitle, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
          Welcome Back
        </Text>

        <Text style={[styles.welcomeSubtitle, { color: isLight ? '#64748B' : '#94A3B8' }]}>
          Enter your PIN or use biometrics.
        </Text>

        {/* 4 PIN Indicator Boxes */}
        <View style={styles.pinBoxesRow}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = idx < pin.length;
            return (
              <View
                key={idx}
                style={[
                  styles.pinBox,
                  {
                    backgroundColor: isFilled
                      ? isLight ? '#0F172A' : '#FFFFFF'
                      : isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.06)',
                    borderColor: error
                      ? '#EF4444'
                      : isFilled
                      ? isLight ? '#0F172A' : '#FFFFFF'
                      : isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)'
                  }
                ]}
              >
                {isFilled && (
                  <View style={[styles.dot, { backgroundColor: isLight ? '#FFFFFF' : '#0F172A' }]} />
                )}
              </View>
            );
          })}
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <Text style={[styles.helperText, { color: isLight ? '#94A3B8' : '#64748B' }]}>
            Use 1234 for demo unlock
          </Text>
        )}
      </View>

      {/* Custom Keypad & Forgot PIN */}
      <View style={styles.keypadSection}>
        <CustomNumericKeypad
          onPressDigit={handleDigitPress}
          onDelete={handleDelete}
          onBiometricPress={handleBiometricPress}
          mode={mode}
        />

        <TouchableOpacity style={{ marginTop: 16 }}>
          <Text style={[styles.forgotText, { color: isLight ? '#475569' : '#CBD5E1' }]}>
            Forgot PIN?
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingVertical: 16, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  logoutText: { fontSize: 14, fontWeight: '700' },
  helpPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  helpText: { fontSize: 13, fontWeight: '700' },
  centerSection: { alignItems: 'center', marginVertical: 10 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarInitials: { fontSize: 26, fontWeight: '900' },
  welcomeTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  welcomeSubtitle: { fontSize: 14, marginTop: 4, fontWeight: '500' },
  pinBoxesRow: { flexDirection: 'row', gap: 14, marginTop: 24, marginBottom: 8 },
  pinBox: { width: 52, height: 52, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  errorText: { color: '#EF4444', fontSize: 13, fontWeight: '700', marginTop: 6 },
  helperText: { fontSize: 12, marginTop: 6 },
  keypadSection: { alignItems: 'center', paddingBottom: 20 },
  forgotText: { fontSize: 14, fontWeight: '700' }
});
