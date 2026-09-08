import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppPalette, isLight } from '../../lib/theme';
import { useAuthStore, AuthState } from '../../store/auth.store';
import { Typography } from '../../constants/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal, useAppModal } from '../../components/ui/AppModal';

export default function EditProfileScreen() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const light = isLight(palette.bg);
  const user = useAuthStore((s: AuthState) => s.user);
  const updateProfile = useAuthStore((s: AuthState) => s.updateProfile);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  const userEmail = user?.email || 'authenticated.user@kudi.app';
  const userPhone = user?.phoneNumber || '+234 800 000 0000';

  const displayName = fullName || username || userEmail.split('@')[0] || 'User';
  const initials = displayName
    .replace(/^@/, '')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'K';

  const modal = useAppModal();

  const handlePickAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        modal.alert('Permission Required', 'Please allow access to your photo library to choose a profile picture.', 'warning');
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
    } catch (err: any) {
      console.warn('Avatar picker error:', err);
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
        title: 'Success! 🎉',
        description: 'Your profile details have been updated successfully.',
        type: 'success',
        primaryText: 'OK',
        onPrimaryPress: () => {
          modal.hide();
          router.back();
        }
      });
    } else {
      modal.alert('Error', result.error || 'Failed to update profile. Please try again.', 'error');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.circularBackBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={styles.saveHeaderBtn}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Text style={[Typography.bodyBold, { color: '#3B82F6' }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Avatar Card */}
        <View style={[styles.avatarCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarWrapper} activeOpacity={0.8}>
            <View style={[styles.avatarCircle, { backgroundColor: light ? '#E2E8F0' : '#1E293B', borderColor: '#34D399' }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={[Typography.title1, { color: palette.text, fontSize: 32 }]}>{initials}</Text>
              )}
            </View>
            <View style={[styles.cameraBadge, { backgroundColor: '#3B82F6', borderColor: palette.card }]}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7}>
            <Text style={[Typography.bodyBold, { color: '#3B82F6', marginTop: 10 }]}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Inputs Group */}
        <View style={[styles.inputGroup, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {/* Full Name */}
          <View style={styles.inputField}>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>FULL NAME</Text>
            <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Ionicons name="person-outline" size={18} color={palette.textSecondary} />
              <TextInput
                style={[Typography.body, styles.textInput, { color: palette.text }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Ahmadou Sow"
                placeholderTextColor={palette.textSecondary}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Username */}
          <View style={styles.inputField}>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>USERNAME</Text>
            <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Ionicons name="at-outline" size={18} color={palette.textSecondary} />
              <TextInput
                style={[Typography.body, styles.textInput, { color: palette.text }]}
                value={username}
                onChangeText={setUsername}
                placeholder="e.g. @ahmadou"
                placeholderTextColor={palette.textSecondary}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Email (Readonly) */}
          <View style={styles.inputField}>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>EMAIL ADDRESS</Text>
            <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border, opacity: 0.7 }]}>
              <Ionicons name="mail-outline" size={18} color={palette.textSecondary} />
              <Text style={[Typography.body, { color: palette.textSecondary, flex: 1 }]}>{userEmail}</Text>
              <Ionicons name="lock-closed" size={14} color={palette.textSecondary} />
            </View>
          </View>

          {/* Phone (Readonly) */}
          <View style={styles.inputField}>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>PHONE NUMBER</Text>
            <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border, opacity: 0.7 }]}>
              <Ionicons name="call-outline" size={18} color={palette.textSecondary} />
              <Text style={[Typography.body, { color: palette.textSecondary, flex: 1 }]}>{userPhone}</Text>
              <Ionicons name="lock-closed" size={14} color={palette.textSecondary} />
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={[styles.saveBtn, { backgroundColor: '#3B82F6' }]}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[Typography.bodyBold, { color: '#FFFFFF', fontSize: 16 }]}>Save Profile</Text>
          )}
        </TouchableOpacity>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  circularBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16
  },
  avatarCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 22,
    borderWidth: 1
  },
  avatarWrapper: {
    position: 'relative'
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48
  },
  cameraBadge: {
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
  inputGroup: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    gap: 16
  },
  inputField: {
    gap: 2
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1
  },
  textInput: {
    flex: 1,
    padding: 0
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  }
});
