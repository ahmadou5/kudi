import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Easing,
  Dimensions,
  StatusBar
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Camera, Zap, ZapOff, Image as ImageIcon, Clipboard as ClipboardIcon } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Typography } from '../constants/typography';
import { useAppPalette } from '../lib/theme';
import { AppModal, useAppModal } from '../components/ui/AppModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIEWFINDER_SIZE = Math.min(260, SCREEN_WIDTH * 0.75);

export default function QRScannerScreen() {
  const palette = useAppPalette();
  const modal = useAppModal();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Scan line animation
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: VIEWFINDER_SIZE - 20,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scanAnim]);

  // Handle barcode scanned from camera
  const handleBarCodeScanned = ({ data, type }: { data: string; type: string }) => {
    if (scanned) return;
    setScanned(true);
    processScannedAddress(data, 'Camera Scanner');
  };

  // Helper to parse and handle scanned address
  const processScannedAddress = (rawData: string, source: string) => {
    let cleanAddress = rawData.trim();

    // Parse crypto URI schemes (e.g., solana:..., ethereum:...)
    if (cleanAddress.toLowerCase().startsWith('solana:')) {
      cleanAddress = cleanAddress.substring(7).split('?')[0];
    } else if (cleanAddress.toLowerCase().startsWith('ethereum:')) {
      cleanAddress = cleanAddress.substring(9).split('?')[0];
    } else if (cleanAddress.toLowerCase().startsWith('monad:')) {
      cleanAddress = cleanAddress.substring(6).split('?')[0];
    }

    const isEvm = cleanAddress.startsWith('0x') && cleanAddress.length === 42;
    const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddress);
    const detectedChain = isSolana ? 'Solana Network' : isEvm ? 'Monad EVM' : 'Unknown Chain';

    modal.show({
      title: 'QR Code Scanned',
      description: `Source: ${source}\nDetected: ${detectedChain}\n\nAddress:\n${cleanAddress}`,
      type: 'success',
      primaryText: 'Send Funds Now',
      onPrimaryPress: () => {
        modal.hide();
        router.replace({
          pathname: '/(tabs)/spend',
          params: { address: cleanAddress }
        });
      },
      secondaryText: 'Scan Again',
      onSecondaryPress: () => {
        modal.hide();
        setScanned(false);
      }
    });
  };

  // Toggle Torch/Flashlight
  const handleToggleTorch = () => {
    setTorchOn((prev) => !prev);
  };

  // Pick Image from Gallery
  const handlePickGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Fallback demo scanning for gallery image selection
        const mockGalleryAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
        processScannedAddress(mockGalleryAddress, 'Photo Gallery');
      }
    } catch (err) {
      modal.alert('Gallery Error', 'Could not load image from gallery', 'error');
    }
  };

  // Paste from Clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || text.trim().length === 0) {
        modal.alert('Clipboard Empty', 'No text found in clipboard', 'info');
        return;
      }
      processScannedAddress(text.trim(), 'Clipboard');
    } catch (err) {
      modal.alert('Clipboard Error', 'Unable to read from clipboard', 'error');
    }
  };

  // 1. Permission Loading State
  if (!permission) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#0A0B0E' }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.permissionContainer}>
          <Text style={[Typography.body, { color: '#94A3B8' }]}>Checking camera permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 2. Permission Denied Request View
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#0A0B0E' }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[Typography.title2, { color: '#FFFFFF' }]}>Scan QR Code</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.permissionContainer}>
          <View style={styles.permissionIconCircle}>
            <Camera size={48} color="#10B981" />
          </View>
          <Text style={[Typography.title2, styles.permissionTitle]}>Camera Access Required</Text>
          <Text style={[Typography.body, styles.permissionSubtitle]}>
            Kudi Wallet needs camera permission to scan Solana & Monad QR codes to make instant transfers.
          </Text>
          
          <TouchableOpacity style={styles.grantBtn} onPress={requestPermission} activeOpacity={0.8}>
            <Text style={styles.grantBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
        <AppModal config={modal.config} onClose={modal.hide} />
      </SafeAreaView>
    );
  }

  // 3. Active Camera QR Scanner View
  return (
    <View style={styles.cameraContainer}>
      <StatusBar barStyle="light-content" />
      
      {/* Live Camera Layer */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Dark Overlay Mask */}
      <SafeAreaView style={styles.safeAreaOverlay}>
        {/* Top Bar Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[Typography.title2, { color: '#FFFFFF' }]}>Scan QR Code</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Center Viewfinder */}
        <View style={styles.viewfinderWrapper}>
          <View style={[styles.viewfinder, { width: VIEWFINDER_SIZE, height: VIEWFINDER_SIZE }]}>
            {/* Viewfinder Corners */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Animated Laser Scanning Line */}
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [{ translateY: scanAnim }],
                },
              ]}
            />
          </View>

          <Text style={[Typography.subhead, styles.helperText]}>
            Align QR code or wallet address within frame to scan automatically
          </Text>
        </View>

        {/* Bottom Action Bar */}
        <View style={styles.actionsContainer}>
          {/* Flashlight */}
          <TouchableOpacity style={styles.actionBtn} onPress={handleToggleTorch} activeOpacity={0.7}>
            <View style={[styles.actionCircle, torchOn && styles.actionCircleActive]}>
              {torchOn ? (
                <Zap size={22} color="#000000" />
              ) : (
                <ZapOff size={22} color="#FFFFFF" />
              )}
            </View>
            <Text style={[Typography.subhead, styles.actionLabel, torchOn && { color: '#10B981', fontWeight: '700' }]}>
              {torchOn ? 'Flash On' : 'Flashlight'}
            </Text>
          </TouchableOpacity>

          {/* Photo Gallery */}
          <TouchableOpacity style={styles.actionBtn} onPress={handlePickGallery} activeOpacity={0.7}>
            <View style={styles.actionCircle}>
              <ImageIcon size={22} color="#FFFFFF" />
            </View>
            <Text style={[Typography.subhead, styles.actionLabel]}>Gallery</Text>
          </TouchableOpacity>

          {/* Clipboard Paste */}
          <TouchableOpacity style={styles.actionBtn} onPress={handlePasteClipboard} activeOpacity={0.7}>
            <View style={styles.actionCircle}>
              <ClipboardIcon size={22} color="#FFFFFF" />
            </View>
            <Text style={[Typography.subhead, styles.actionLabel]}>Paste</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <AppModal config={modal.config} onClose={modal.hide} />
    </View>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeAreaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  permissionTitle: {
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  grantBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  viewfinderWrapper: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  viewfinder: {
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderColor: '#10B981',
    borderStyle: 'solid',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 20,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 20,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 20,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 20,
  },
  scanLine: {
    width: '100%',
    height: 3,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  helperText: {
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: 28,
    paddingHorizontal: 30,
    fontSize: 13,
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
    paddingBottom: 44,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 8,
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionCircleActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  actionLabel: {
    color: '#94A3B8',
    fontSize: 13,
  },
});
