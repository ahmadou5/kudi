import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { StyleSheet, Modal, StyleProp, ViewStyle } from 'react-native';
import BottomSheet, {
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppPalette, hexToRgba } from '../../lib/theme';
import { haptics } from '../../lib/haptics';
import { CardBackgroundPattern } from './CardBackgroundPattern';

interface GorhomBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: string[];
  /** When false, pan-down and backdrop tap won't dismiss the sheet (forced flows). Default true. */
  dismissible?: boolean;
  /** Render children inside BottomSheetScrollView (forms/lists that scroll). Default false. */
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardBehavior?: 'extend' | 'fillParent' | 'interactive';
  keyboardBlurBehavior?: 'none' | 'restore';
  android_keyboardInputMode?: 'adjustPan' | 'adjustResize';
}

export const GorhomBottomSheet: React.FC<GorhomBottomSheetProps> = ({
  visible,
  onClose,
  children,
  snapPoints: customSnapPoints,
  dismissible = true,
  scrollable = false,
  contentContainerStyle,
  keyboardBehavior,
  keyboardBlurBehavior,
  android_keyboardInputMode
}) => {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Dynamic Snap points (e.g. 52% collapsed resting, 88% expanded)
  const snapPoints = useMemo(() => customSnapPoints || ['52%', '88%'], [customSnapPoints]);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.snapToIndex(0);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    } else {
      haptics.tap();
    }
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.65}
        pressBehavior={dismissible ? 'close' : 'none'}
      />
    ),
    [dismissible]
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.modalRoot}>

        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose={dismissible}
          onChange={handleSheetChanges}
          backdropComponent={renderBackdrop}
          keyboardBehavior={keyboardBehavior}
          keyboardBlurBehavior={keyboardBlurBehavior}
          android_keyboardInputMode={android_keyboardInputMode}
          backgroundStyle={[
            styles.backgroundStyle,
            {
              backgroundColor: palette.card,

            }
          ]}
          handleIndicatorStyle={[
            styles.indicatorStyle,
            { backgroundColor: isDark ? hexToRgba(palette.text, 0.3) : hexToRgba(palette.text, 0.25) }
          ]}
        >
          <CardBackgroundPattern
            glowColor={hexToRgba(palette.success, isDark ? 0.08 : 0.05)}
            isDarkOverride={isDark}
          />
          {scrollable ? (
            <BottomSheetScrollView
              contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </BottomSheetScrollView>
          ) : (
            <BottomSheetView style={[styles.contentContainer, contentContainerStyle]}>
              {children}
            </BottomSheetView>
          )}
        </BottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1
  },
  backgroundStyle: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,

    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20
  },
  indicatorStyle: {
    width: 42,
    height: 5,
    borderRadius: 2.5
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24
  }
});
