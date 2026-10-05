import React from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPalette } from '../../lib/theme';

interface SendSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Prevent dismissing (e.g. while a transfer is in flight). */
  locked?: boolean;
}

/** Simple bottom sheet used for the review/confirm step of the send flows. */
export const SendSheet: React.FC<SendSheetProps> = ({ visible, onClose, children, locked = false }) => {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const handleClose = () => {
    if (!locked) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: palette.bg, paddingBottom: Math.max(insets.bottom, 12) + 8 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: palette.border }]} />
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close"
          >
            <X size={22} color={palette.text} />
          </TouchableOpacity>
          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 8,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 4,
  },
});
