import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  TouchableWithoutFeedback
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppPalette } from '../../lib/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;

interface DraggableBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const DraggableBottomSheet: React.FC<DraggableBottomSheetProps> = ({
  visible,
  onClose,
  children
}) => {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';

  // Animated values for translation & opacity
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset translation and animate bottom sheet up
      translateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true
        })
      ]).start();
    } else {
      dismissSheet();
    }
  }, [visible]);

  const dismissSheet = (velocity: number = 0) => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT,
        velocity: velocity,
        friction: 9,
        tension: 80,
        useNativeDriver: true
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => {
      onClose();
    });
  };

  // PanResponder for 1:1 physical hand dragging (drag up to stretch, drag down to adjust/dismiss)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only set pan responder if vertical movement is significant
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // Extract offset so drag starts smoothly from current position
        translateY.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        const { dy } = gestureState;
        if (dy < 0) {
          // Dragging UP — apply Apple rubber-banding damping (resist past top)
          const rubberBandedDy = -Math.pow(-dy, 0.78);
          translateY.setValue(rubberBandedDy);
        } else {
          // Dragging DOWN — 1:1 direct tracking
          translateY.setValue(dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        const { dy, vy } = gestureState;

        // Trigger dismiss if dragged down past threshold OR flicked down with velocity
        if (dy > DISMISS_THRESHOLD || vy > VELOCITY_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          dismissSheet(vy);
        } else {
          // Snap back to resting position
          Animated.spring(translateY, {
            toValue: 0,
            velocity: vy,
            friction: 7,
            tension: 70,
            useNativeDriver: true
          }).start();
        }
      }
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => dismissSheet()}
    >
      <View style={styles.modalContainer}>
        {/* Animated Fade Backdrop */}
        <TouchableWithoutFeedback onPress={() => dismissSheet()}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.65]
                })
              }
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Gesture Draggable Sheet Container */}
        <Animated.View
          style={[
            styles.sheetCard,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              transform: [{ translateY }]
            }
          ]}
        >
          {/* Touch Drag Handle Zone */}
          <View {...panResponder.panHandlers} style={styles.dragHeaderZone}>
            <View
              style={[
                styles.dragHandle,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.2)' }
              ]}
            />
          </View>

          {/* Sheet Content */}
          <View style={styles.contentContainer}>
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000'
  },
  sheetCard: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.88,
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
  dragHeaderZone: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 36
  }
});
