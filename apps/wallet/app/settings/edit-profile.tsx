import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, AtSign, Camera, Lock, Mail, Phone, User } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppPalette, hexToRgba } from '../../src/lib/theme';
import { useAuthStore, AuthState } from '../../src/store/auth.store';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AppModal, useAppModal } from '../../src/components/ui/AppModal';
import { Avatar, userAvatarSeed } from '../../src/components/Avatar';
import { EnterSection } from '../../src/lib/animations';

export default function EditProfileScreen() {
  const palette = useAppPalette();
  const user = useAuthStore((s: AuthState) => s.user);
  const updateProfile = useAuthStore((s: AuthState) => s.updateProfile);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);

  const userEmail = user?.email || 'authenticated.user@kudi.app';
  const userPhone = user?.phoneNumber || 'Not added yet';

  const modal = useAppModal();

  const handlePickAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        modal.alert(
          'Permission Required',
          'Please allow access to your photo library to choose a profile picture.',
          'warning'
        );
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
        let newAvatarUri = asset.uri;
        if (asset.base64) {
          newAvatarUri = `data:image/jpeg;base64,${asset.base64}`;
        }
        setAvatarUrl(newAvatarUri);
      }
    } catch {
      modal.alert('Error', 'Could not select photo. Please try again.', 'error');
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      modal.alert('Required', 'Please enter your full name.', 'warning');
      return;
    }

    setIsSaving(true);
    let cleanUsername = username.trim();
    if (cleanUsername && !cleanUsername.startsWith('@')) {
      cleanUsername = `@${cleanUsername}`;
    }

    const result = await updateProfile({
      fullName: fullName.trim(),
      username: cleanUsername,
      avatarUrl
    });

    setIsSaving(false);

    if (result.success) {
      modal.show({
        title: 'Profile updated',
        description: 'Your profile details have been updated successfully.',
        type: 'success',
        primaryText: 'Done',
        onPrimaryPress: () => {
          modal.hide();
          router.back();
        }
      });
    } else {
      modal.alert('Error', result.error || 'Failed to update profile. Please try again.', 'error');
    }
  };

  const labelStyle = { color: hexToRgba(palette.text, 0.45) };
  const inputBorder = (focused: boolean) =>
    focused ? { borderWidth: 1.5, borderColor: palette.text } : { borderWidth: 1, borderColor: palette.border };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibility-label="Go back"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: palette.card, borderColor: palette.border },
            pressed && { opacity: 0.6 }
          ]}
        >
          <ArrowLeft size={20} color={palette.text} />
        </Pressable>
        <Text style={[Typography.title1, { color: palette.text }]}>Edit Profile</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Avatar ── */}
          <EnterSection index={0}>
            <View style={[styles.avatarCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Pressable onPress={handlePickAvatar} style={styles.avatarWrapper} accessibilityLabel="Change profile photo">
                <Avatar avatarUrl={avatarUrl} seed={userAvatarSeed(user)} size={96} />
                <View style={[styles.cameraBadge, { backgroundColor: palette.primary, borderColor: palette.card }]}>
                  <Camera size={14} color={palette.bg} strokeWidth={2.2} />
                </View>
              </Pressable>
              <Pressable onPress={handlePickAvatar}>
                <Text style={[Typography.bodyBold, { color: palette.primary, marginTop: 12 }]}>
                  Change Profile Photo
                </Text>
              </Pressable>
            </View>
          </EnterSection>

          {/* ── Profile details ── */}
          <EnterSection index={1}>
            <View style={styles.group}>
              <Text style={[styles.groupLabel, labelStyle]}>PROFILE</Text>
              <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, labelStyle]}>FULL NAME</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      { backgroundColor: palette.bg },
                      inputBorder(nameFocused)
                    ]}
                  >
                    <User size={18} color={nameFocused ? palette.text : palette.textSecondary} />
                    <TextInput
                      style={[Typography.currencySub, styles.textInput, { color: palette.text }]}
                      value={fullName}
                      onChangeText={setFullName}
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                      placeholder="e.g. Ahmadou Sow"
                      placeholderTextColor={hexToRgba(palette.text, 0.35)}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, labelStyle]}>USERNAME</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      { backgroundColor: palette.bg },
                      inputBorder(usernameFocused)
                    ]}
                  >
                    <AtSign
                      size={18}
                      color={usernameFocused ? palette.text : palette.textSecondary}
                    />
                    <TextInput
                      style={[Typography.currencySub, styles.textInput, { color: palette.text }]}
                      value={username}
                      onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
                      onFocus={() => setUsernameFocused(true)}
                      onBlur={() => setUsernameFocused(false)}
                      placeholder="e.g. @ahmadou"
                      placeholderTextColor={hexToRgba(palette.text, 0.35)}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </View>
            </View>
          </EnterSection>

          {/* ── Contact (read-only) ── */}
          <EnterSection index={2}>
            <View style={styles.group}>
              <Text style={[styles.groupLabel, labelStyle]}>CONTACT</Text>
              <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={[styles.readonlyRow, { borderBottomColor: palette.border }]}>
                  <View style={[styles.readonlyIcon, { backgroundColor: hexToRgba(palette.text, 0.07) }]}>
                    <Mail size={17} color={palette.textSecondary} strokeWidth={1.9} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, labelStyle]}>EMAIL ADDRESS</Text>
                    <Text style={[Typography.currencySub, { color: palette.text }]} numberOfLines={1}>
                      {userEmail}
                    </Text>
                  </View>
                  <Lock size={14} color={hexToRgba(palette.text, 0.35)} />
                </View>

                <View style={styles.readonlyRow}>
                  <View style={[styles.readonlyIcon, { backgroundColor: hexToRgba(palette.text, 0.07) }]}>
                    <Phone size={17} color={palette.textSecondary} strokeWidth={1.9} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, labelStyle]}>PHONE NUMBER</Text>
                    <Text style={[Typography.currencySub, { color: palette.text }]} numberOfLines={1}>
                      {userPhone}
                    </Text>
                  </View>
                  <Lock size={14} color={hexToRgba(palette.text, 0.35)} />
                </View>
              </View>
            </View>
          </EnterSection>

          {/* ── Save (primary CTA) ── */}
          <EnterSection index={3}>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              accessibilityRole="button"
              accessibility-label="Save profile"
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: palette.text },
                (isSaving || pressed) && { opacity: 0.9 }
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={palette.bg} />
              ) : (
                <Text style={[Typography.currencySub, { color: palette.bg }]}>Save Profile</Text>
              )}
            </Pressable>
          </EnterSection>

          <AppModal config={modal.config} onClose={modal.hide} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16
  },
  avatarCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1
  },
  avatarWrapper: {
    position: 'relative'
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3
  },
  group: { gap: 8 },
  groupLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4
  },
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 16
  },
  field: { gap: 8 },
  fieldLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase'
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14
  },
  textInput: {
    flex: 1,
    padding: 0
  },
  readonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  readonlyIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6
  }
});
