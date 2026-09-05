import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../constants/typography';

export interface HeaderProps {
  mode?: 'light' | 'dark';
  onToggleMode?: () => void;
  onOpenSettings?: () => void;
  onOpenScanner?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode = 'dark',
  onToggleMode,
  onOpenSettings,
  onOpenScanner
}) => {
  const isLight = mode === 'light';

  return (
    <View style={[styles.header, { backgroundColor: isLight ? '#FFFFFF' : '#090A0F', borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.1)' }]}>
      {/* Top Left: Settings Icon */}
      <TouchableOpacity
        onPress={onOpenSettings}
        style={[styles.iconBtn, { backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)', borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.15)' }]}
        activeOpacity={0.7}
      >
        <Ionicons name="settings-outline" size={19} color={isLight ? '#0F172A' : '#FFFFFF'} />
      </TouchableOpacity>

      {/* Center: Title / Pill Badge */}
      <View style={styles.centerBadgeContainer}>
        <View style={[styles.pillBadge, { backgroundColor: isLight ? '#0F172A' : 'rgba(255,255,255,0.12)' }]}>
          <Text style={[Typography.caption, { color: '#FFFFFF' }]}>Kudi Float</Text>
        </View>
      </View>

      {/* Top Right: Theme Toggle & Scanner Icons */}
      <View style={styles.rightActions}>
        <TouchableOpacity
          onPress={onToggleMode}
          style={[styles.iconBtn, { backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)', borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.15)' }]}
          activeOpacity={0.7}
        >
          <Ionicons name={isLight ? 'moon-outline' : 'sunny-outline'} size={18} color={isLight ? '#0F172A' : '#FFFFFF'} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onOpenScanner}
          style={[styles.iconBtn, { backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)', borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.15)' }]}
          activeOpacity={0.7}
        >
          <Ionicons name="qr-code-outline" size={18} color={isLight ? '#0F172A' : '#FFFFFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  centerBadgeContainer: {
    flex: 1,
    alignItems: 'center'
  },
  pillBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  }
});
