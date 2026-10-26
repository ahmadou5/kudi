import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image
} from 'react-native';
import {
  User,
  Calendar,
  AtSign,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Camera,
  Check,
  Zap,
  Smile
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppPalette, hexToRgba } from '../lib/theme';
import { Typography } from '../constants/typography';
import { useAuthStore, AuthState } from '../store/auth.store';
import { DobDatePickerModal } from './ui/DobDatePickerModal';
import { FlowProgressDots } from './wallet/WalletFlowProgress';
import { userAvatarSeed } from './Avatar';
import { Blobatar, isBlobatarUrl, blobatarSeed, toBlobatarUrl } from './Blobatar';
import { GorhomBottomSheet } from './ui/GorhomBottomSheet';
import { haptics } from '../lib/haptics';

export function ProfileOnboardingModal() {
  const palette = useAppPalette();
  const user = useAuthStore((s: AuthState) => s.user);
  const isAuthenticated = useAuthStore((s: AuthState) => s.isAuthenticated);
  const updateProfile = useAuthStore((s: AuthState) => s.updateProfile);

  // Step state (1: Names, 2: Username, 3: Date of Birth, 4: Avatar)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  // Custom uploaded photo (data URI / file URI / remote URL), or null when
  // the generated Blobatar is the chosen avatar.
  const [avatarPhoto, setAvatarPhoto] = useState<string | null>(null);
  const [blobSeed, setBlobSeed] = useState('');

  const [isDobPickerVisible, setIsDobPickerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Determine if profile is incomplete
  const isProfileIncomplete =
    isAuthenticated &&
    user &&
    (!user.profileCompleted && (!user.username || !user.fullName || user.fullName.trim() === '' || user.fullName === 'User'));

  useEffect(() => {
    if (user) {
      if (user.fullName && user.fullName !== 'User') {
        const parts = user.fullName.trim().split(' ');
        if (parts.length >= 2) {
          setFirstName(parts[0]);
          setLastName(parts.slice(1).join(' '));
        } else {
          setFirstName(user.fullName);
        }
      }
      if (user.username) setUsername(user.username.replace(/^@/, ''));
      if (user.dob) setDob(user.dob);
      const seedBase = userAvatarSeed(user);
      if (user.avatarUrl && isBlobatarUrl(user.avatarUrl)) {
        setBlobSeed((prev) => prev || blobatarSeed(user.avatarUrl as string, seedBase));
      } else if (user.avatarUrl) {
        setAvatarPhoto(user.avatarUrl);
      }
      setBlobSeed((prev) => prev || seedBase);
    }
  }, [user]);

  if (!isProfileIncomplete) {
    return null;
  }

  // Stable grid of generated characters: the user's default seed plus variants.
  const baseSeed = userAvatarSeed(user);
  const defaultSeeds = [1, 2, 3, 4, 5, 6].map((n) => (n === 1 ? baseSeed : `${baseSeed}-${n}`));
  const avatarSeeds =
    blobSeed && !defaultSeeds.includes(blobSeed) ? [blobSeed, ...defaultSeeds] : defaultSeeds;

  const handleNextStep = () => {
    setErrorMsg('');
    haptics.impact('light');

    if (step === 1) {
      if (!firstName.trim() || firstName.trim().length < 2) {
        setErrorMsg('Please enter a valid first name');
        return;
      }
      if (!lastName.trim() || lastName.trim().length < 2) {
        setErrorMsg('Please enter a valid last name');
        return;
      }
      // Auto-suggest username if empty
      if (!username) {
        const suggested = `${firstName.trim().toLowerCase()}_${lastName.trim().toLowerCase()}`.replace(/[^a-z0-9_]/g, '');
        setUsername(suggested);
      }
      setStep(2);
    } else if (step === 2) {
      const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!cleanUser || cleanUser.length < 3) {
        setErrorMsg('Username must be at least 3 characters');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!dob) {
        setErrorMsg('Please select your date of birth');
        return;
      }
      setStep(4);
    }
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    haptics.impact('light');
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handlePickCustomPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMsg('Photo library permission is required to choose a photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setAvatarPhoto(uri);
      }
    } catch (err: any) {
      console.warn('Avatar picker error:', err);
    }
  };

  const handleFinalSubmit = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    haptics.impact('medium');

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    try {
      const res = await updateProfile({
        firstName: cleanFirst,
        lastName: cleanLast,
        fullName: `${cleanFirst} ${cleanLast}`,
        username: `@${cleanUser}`,
        dob,
        avatarUrl: avatarPhoto || toBlobatarUrl(blobSeed || userAvatarSeed(user)),
        profileCompleted: true
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to complete profile. Please try again.');
      } else {
        haptics.notify('success');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred while saving profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDisplayDob = (rawDob: string) => {
    if (!rawDob) return 'Select Date of Birth';
    try {
      const date = new Date(rawDob);
      if (isNaN(date.getTime())) return rawDob;
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return rawDob;
    }
  };

  // Generate 3 username suggestions based on name
  const suggestedUsernames = [
    `${firstName.trim().toLowerCase()}${lastName.trim().toLowerCase()}`.replace(/[^a-z0-9_]/g, ''),
    `${firstName.trim().toLowerCase()}_${lastName.trim().toLowerCase()}`.replace(/[^a-z0-9_]/g, ''),
    `${firstName.trim().toLowerCase()}_kudi`.replace(/[^a-z0-9_]/g, '')
  ].filter(Boolean);

  return (
    <>
      <GorhomBottomSheet
        visible
        onClose={() => { }}
        snapPoints={['90%']}
        dismissible={false}
        scrollable
        contentContainerStyle={styles.scrollForm}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
              {/* Progress Indicator */}
              <View style={styles.headerRow}>
                {step > 1 ? (
                  <TouchableOpacity onPress={handlePrevStep} style={styles.backBtn} activeOpacity={0.7}>
                    <ArrowLeft size={20} color={palette.text} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.backPlaceholder} />
                )}

                <FlowProgressDots
                  currentStep={step}
                  totalSteps={4}
                  color={palette.primary}
                  onStepPress={(targetStep) => {
                    if (targetStep < step) setStep(targetStep as 1 | 2 | 3 | 4);
                  }}
                />

                <Text style={[Typography.caption, { color: palette.textSecondary, fontSize: 11, fontWeight: '700' }]}>
                  {step}/4
                </Text>
              </View>

              {errorMsg ? (
                  <View style={[styles.errorBox, { backgroundColor: hexToRgba('#EF4444', 0.12), borderColor: hexToRgba('#EF4444', 0.3) }]}>
                    <Text style={[Typography.caption, { color: '#EF4444', fontWeight: '600' }]}>{errorMsg}</Text>
                  </View>
                ) : null}

                {/* STEP 1: NAMES */}
                {step === 1 && (
                  <View style={styles.stepContainer}>
                    <View style={[styles.stepIconBadge, { backgroundColor: hexToRgba(palette.primary, 0.15) }]}>
                      <User size={26} color={palette.primary} />
                    </View>
                    <Text style={[Typography.title1, styles.titleText, { color: palette.text }]}>
                      What's your name?
                    </Text>
                    <Text style={[Typography.caption, styles.subtitleText, { color: palette.textSecondary }]}>
                      Enter your official name to set up your Kudi profile.
                    </Text>

                    <View style={styles.fieldContainer}>
                      <Text style={[Typography.caption, styles.fieldLabel, { color: palette.textSecondary, fontWeight: '700' }]}>
                        FIRST NAME
                      </Text>
                      <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                        <TextInput
                          value={firstName}
                          onChangeText={setFirstName}
                          placeholder="First name"
                          placeholderTextColor={palette.textSecondary + '80'}
                          style={[Typography.body, styles.textInput, { color: palette.text }]}
                          autoCapitalize="words"
                        />
                      </View>
                    </View>

                    <View style={styles.fieldContainer}>
                      <Text style={[Typography.caption, styles.fieldLabel, { color: palette.textSecondary, fontWeight: '700' }]}>
                        LAST NAME
                      </Text>
                      <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                        <TextInput
                          value={lastName}
                          onChangeText={setLastName}
                          placeholder="Last name"
                          placeholderTextColor={palette.textSecondary + '80'}
                          style={[Typography.body, styles.textInput, { color: palette.text }]}
                          autoCapitalize="words"
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={handleNextStep}
                      activeOpacity={0.85}
                      style={[styles.actionBtn, { backgroundColor: palette.primary }]}
                    >
                      <Text style={[Typography.bodyBold, styles.actionBtnText]}>Next: Choose Handle</Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* STEP 2: USERNAME / HANDLE */}
                {step === 2 && (
                  <View style={styles.stepContainer}>
                    <View style={[styles.stepIconBadge, { backgroundColor: hexToRgba(palette.primary, 0.15) }]}>
                      <AtSign size={26} color={palette.primary} />
                    </View>
                    <Text style={[Typography.title1, styles.titleText, { color: palette.text }]}>
                      Choose your Username
                    </Text>
                    <Text style={[Typography.caption, styles.subtitleText, { color: palette.textSecondary }]}>
                      Your unique `@handle` lets anyone search and send funds to you with zero transaction fees.
                    </Text>

                    <View style={styles.fieldContainer}>
                      <Text style={[Typography.caption, styles.fieldLabel, { color: palette.textSecondary, fontWeight: '700' }]}>
                        KUDI HANDLE
                      </Text>
                      <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                        <Text style={[Typography.title2, { color: palette.primary }]}>@</Text>
                        <TextInput
                          value={username}
                          onChangeText={(val) => setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          placeholder="username"
                          placeholderTextColor={palette.textSecondary + '80'}
                          style={[Typography.body, styles.textInput, { color: palette.text, fontWeight: '600' }]}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        {username.trim().length >= 3 && (
                          <CheckCircle2 size={18} color="#10B981" />
                        )}
                      </View>
                    </View>

                    {/* Handle Suggestions */}
                    {suggestedUsernames.length > 0 && (
                      <View style={styles.suggestionsContainer}>
                        <Text style={[Typography.caption, { color: palette.textSecondary, fontSize: 11 }]}>
                          SUGGESTED HANDLES:
                        </Text>
                        <View style={styles.suggestionsRow}>
                          {suggestedUsernames.map((sug, idx) => (
                            <TouchableOpacity
                              key={idx}
                              onPress={() => setUsername(sug)}
                              style={[
                                styles.sugChip,
                                {
                                  backgroundColor: username === sug ? hexToRgba(palette.primary, 0.18) : palette.bg,
                                  borderColor: username === sug ? palette.primary : palette.border
                                }
                              ]}
                            >
                              <Text style={[Typography.caption, { color: username === sug ? palette.primary : palette.text, fontWeight: '700' }]}>
                                @{sug}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={handleNextStep}
                      activeOpacity={0.85}
                      style={[styles.actionBtn, { backgroundColor: palette.primary }]}
                    >
                      <Text style={[Typography.bodyBold, styles.actionBtnText]}>Next: Date of Birth</Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* STEP 3: DATE OF BIRTH */}
                {step === 3 && (
                  <View style={styles.stepContainer}>
                    <View style={[styles.stepIconBadge, { backgroundColor: hexToRgba(palette.primary, 0.15) }]}>
                      <Calendar size={26} color={palette.primary} />
                    </View>
                    <Text style={[Typography.title1, styles.titleText, { color: palette.text }]}>
                      Date of Birth
                    </Text>
                    <Text style={[Typography.caption, styles.subtitleText, { color: palette.textSecondary }]}>
                      Required to unlock higher transaction tiers and financial compliance.
                    </Text>

                    <View style={styles.fieldContainer}>
                      <Text style={[Typography.caption, styles.fieldLabel, { color: palette.textSecondary, fontWeight: '700' }]}>
                        SELECT DATE OF BIRTH
                      </Text>
                      <TouchableOpacity
                        onPress={() => setIsDobPickerVisible(true)}
                        activeOpacity={0.8}
                        style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border, height: 52 }]}
                      >
                        <Calendar size={20} color={palette.primary} />
                        <Text style={[Typography.bodyBold, { color: dob ? palette.text : palette.textSecondary + '80', flex: 1, marginLeft: 8 }]}>
                          {formatDisplayDob(dob)}
                        </Text>
                        <Text style={[Typography.caption, { color: palette.primary, fontWeight: '700' }]}>Change</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={handleNextStep}
                      activeOpacity={0.85}
                      style={[styles.actionBtn, { backgroundColor: palette.primary }]}
                    >
                      <Text style={[Typography.bodyBold, styles.actionBtnText]}>Next: Choose Avatar</Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* STEP 4: AVATAR SELECTION */}
                {step === 4 && (
                  <View style={styles.stepContainer}>
                    <View style={styles.avatarPreviewArea}>
                      <View style={styles.mainAvatarImg}>
                        {avatarPhoto ? (
                          <Image source={{ uri: avatarPhoto }} style={styles.mainAvatarFill} />
                        ) : (
                          <Blobatar name={blobSeed || baseSeed} size={82} />
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={handlePickCustomPhoto}
                        style={[styles.customPhotoBadge, { backgroundColor: palette.primary, borderColor: palette.card }]}
                        activeOpacity={0.8}
                      >
                        <Camera size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>

                    <Text style={[Typography.title1, styles.titleText, { color: palette.text }]}>
                      Choose an Avatar
                    </Text>
                    <Text style={[Typography.caption, styles.subtitleText, { color: palette.textSecondary }]}>
                      Pick a generated character or upload your own photo.
                    </Text>

                    {/* Generated Blobatar variants */}
                    <View style={styles.avatarGrid}>
                      {avatarSeeds.map((seed) => {
                        const isSelected = !avatarPhoto && blobSeed === seed;
                        return (
                          <TouchableOpacity
                            key={seed}
                            onPress={() => {
                              setAvatarPhoto(null);
                              setBlobSeed(seed);
                            }}
                            activeOpacity={0.8}
                            style={[
                              styles.avatarGridItem,
                              { borderColor: isSelected ? palette.primary : palette.border }
                            ]}
                          >
                            <Blobatar name={seed} size={53} />
                            {isSelected && (
                              <View style={[styles.checkBadge, { backgroundColor: palette.primary }]}>
                                <Check size={12} color="#FFFFFF" />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      onPress={handlePickCustomPhoto}
                      activeOpacity={0.7}
                      style={[styles.uploadPhotoBtn, { backgroundColor: palette.bg, borderColor: palette.border }]}
                    >
                      <Camera size={18} color={palette.text} />
                      <Text style={[Typography.bodyBold, { color: palette.text }]}>Upload Photo from Gallery</Text>
                    </TouchableOpacity>

                    {/* Submit Button */}
                    <TouchableOpacity
                      onPress={handleFinalSubmit}
                      disabled={isSubmitting}
                      activeOpacity={0.85}
                      style={[styles.actionBtn, { backgroundColor: palette.primary, marginTop: 10 }]}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Text style={[Typography.bodyBold, styles.actionBtnText]}>
                            Complete Setup & Get Started ✨
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
      </GorhomBottomSheet>

      {/* Date of birth picker sheet */}
      <DobDatePickerModal
        visible={isDobPickerVisible}
        initialValue={dob}
        onClose={() => setIsDobPickerVisible(false)}
        onSelect={(selectedDate) => {
          setDob(selectedDate);
          setIsDobPickerVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backPlaceholder: {
    width: 36
  },
  scrollForm: {
    paddingBottom: 20
  },
  stepContainer: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 8
  },
  stepIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center'
  },
  subtitleText: {
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginTop: -8,
    marginBottom: 4
  },
  errorBox: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 10
  },
  fieldContainer: {
    width: '100%',
    gap: 6
  },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 0.8
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    height: '100%'
  },
  suggestionsContainer: {
    width: '100%',
    gap: 6,
    marginTop: -4
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sugChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1
  },
  avatarPreviewArea: {
    position: 'relative',
    marginVertical: 4
  },
  mainAvatarImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#3B82F6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  mainAvatarFill: {
    width: '100%',
    height: '100%'
  },
  customPhotoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginVertical: 8
  },
  avatarGridItem: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  uploadPhotoBtn: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  actionBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  }
});
