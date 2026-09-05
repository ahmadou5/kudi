import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../constants/typography';
import { useAppPalette } from '../lib/theme';
import { Colors } from '../constants/palette';

export default function QRScannerScreen() {
  const [torchOn, setTorchOn] = useState(false);
  const palette = useAppPalette();
  const handleToggleTorch = () => {
    setTorchOn((prev) => !prev);
    Alert.alert('Flashlight', torchOn ? 'Flashlight turned off' : 'Flashlight turned on');
  };

  const handlePickGallery = () => {
    Alert.alert('Gallery', 'Select a QR code image from your photo library');
  };

  const handlePasteClipboard = () => {
    Alert.alert('Clipboard', 'Scanned wallet address pasted from clipboard: 0x71C...4b82');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: '#FFFFFF' }]}>Scan QR Code</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Center Viewfinder */}
      <View style={styles.viewfinderContainer}>
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          <View style={styles.scanLine} />
        </View>

        <Text style={[Typography.subhead, styles.helperText]}>
          Align QR code or wallet address within the frame to scan automatically
        </Text>
      </View>

      {/* Bottom Action Controls */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleToggleTorch} activeOpacity={0.7}>
          <View style={[styles.actionCircle, torchOn && styles.actionCircleActive]}>
            <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={22} color={torchOn ? '#000000' : '#FFFFFF'} />
          </View>
          <Text style={[Typography.subhead, styles.actionLabel]}>Flashlight</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handlePickGallery} activeOpacity={0.7}>
          <View style={styles.actionCircle}>
            <Ionicons name="image-outline" size={22} color="#FFFFFF" />
          </View>
          <Text style={[Typography.subhead, styles.actionLabel]}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handlePasteClipboard} activeOpacity={0.7}>
          <View style={styles.actionCircle}>
            <Ionicons name="clipboard-outline" size={22} color="#FFFFFF" />
          </View>
          <Text style={[Typography.subhead, styles.actionLabel]}>Paste</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Typography.xl,
    backgroundColor: Colors.dark.card,
    justifyContent: 'space-between'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewfinderContainer: {
    alignItems: 'center',
    paddingHorizontal: 30
  },
  viewfinder: {
    width: 250,
    height: 250,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: '#10B981',
    borderStyle: 'solid'
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16
  },
  scanLine: {
    width: '85%',
    height: 2,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 5
  },
  helperText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
    paddingBottom: 40
  },
  actionBtn: {
    alignItems: 'center',
    gap: 8
  },
  actionCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionCircleActive: {
    backgroundColor: '#10B981'
  },
  actionLabel: {
    color: '#94A3B8'
  }
});
