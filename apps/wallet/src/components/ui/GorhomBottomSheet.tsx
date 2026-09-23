import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useAppPalette } from '../../lib/theme';

interface GorhomBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: string[];
}

export const GorhomBottomSheet: React.FC<GorhomBottomSheetProps> = ({
  visible,
  onClose,
  children,
  snapPoints: customSnapPoints
}) => {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Dynamic Snap points (e.g. 50% collapsed resting, 88% expanded)
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
      Haptics.selectionAsync().catch(() => {});
    }
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.65}
      />
    ),
    []
  );

  if (!visible) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        styles.backgroundStyle,
        {
          backgroundColor: palette.card,
          borderColor: palette.border
        }
      ]}
      handleIndicatorStyle={[
        styles.indicatorStyle,
        { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(15, 23, 42, 0.25)' }
      ]}
    >
      <BottomSheetView style={styles.contentContainer}>
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  backgroundStyle: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
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
