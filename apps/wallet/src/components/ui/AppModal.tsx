import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { XCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react-native';

import { Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import { useAppPalette } from '../../lib/theme';

export type AppModalConfig = {
  visible: boolean;
  title: string;
  description: string;
  type: 'info' | 'error' | 'success' | 'warning';
  primaryText: string;
  onPrimaryPress: () => void;
  secondaryText?: string;
  onSecondaryPress?: () => void;
};

const EMPTY: AppModalConfig = {
  visible: false,
  title: '',
  description: '',
  type: 'info',
  primaryText: 'OK',
  onPrimaryPress: () => {},
};

export type ShowAlertOptions = {
  title: string;
  description: string;
  type?: AppModalConfig['type'];
  primaryText?: string;
  onPrimaryPress?: () => void;
  secondaryText?: string;
  onSecondaryPress?: () => void;
};

// ─── Local Hook ──────────────────────────────────────────────────────────────
export function useAppModal() {
  const [config, setConfig] = useState<AppModalConfig>(EMPTY);

  const show = (opts: Omit<AppModalConfig, 'visible'>) =>
    setConfig({ ...opts, visible: true });

  const hide = () => setConfig((prev) => ({ ...prev, visible: false }));

  /** Convenience: show a simple info/success/error prompt */
  const alert = (
    title: string,
    description: string,
    type: AppModalConfig['type'] = 'info',
    primaryText: string = 'OK',
    onPrimaryPress?: () => void
  ) =>
    show({
      title,
      description,
      type,
      primaryText,
      onPrimaryPress: () => {
        hide();
        if (onPrimaryPress) onPrimaryPress();
      },
    });

  return { config, setConfig, show, hide, alert };
}

// ─── Modal UI Component ──────────────────────────────────────────────────────
type Props = {
  config: AppModalConfig;
  onClose: () => void;
};

export function AppModal({ config, onClose }: Props) {
  const palette = useAppPalette();

  const iconBg =
    config.type === 'error'   ? `${palette.error}1A` :
    config.type === 'success' ? `${palette.success}1A` :
    config.type === 'warning' ? `${palette.warning}1A` :
    `${palette.primary}1A`;

  const primaryBg =
    config.type === 'error'   ? palette.error :
    config.type === 'warning' ? palette.error :
    palette.primary;

  const isDarkBg = palette.bg === '#090A0F';
  const primaryTextColor =
    config.type === 'error' || config.type === 'warning'
      ? '#FFFFFF'
      : isDarkBg
      ? '#090A0F'
      : '#FFFFFF';

  return (
    <Modal
      transparent
      visible={config.visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            {config.type === 'error' && (
              <XCircle size={22} color={palette.error} />
            )}
            {config.type === 'success' && (
              <CheckCircle2 size={22} color={palette.success} />
            )}
            {config.type === 'warning' && (
              <AlertTriangle size={22} color={palette.warning} />
            )}
            {config.type === 'info' && (
              <Info size={22} color={palette.primary} />
            )}
          </View>

          <Text style={[styles.title, { color: palette.text }]}>
            {config.title}
          </Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>
            {config.description}
          </Text>

          <View style={styles.actions}>
            {config.secondaryText ? (
              <Pressable
                onPress={() => {
                  onClose();
                  if (config.onSecondaryPress) config.onSecondaryPress();
                }}
                style={[
                  styles.secondary,
                  { backgroundColor: palette.bg, borderColor: palette.border },
                ]}
              >
                <Text style={[styles.secondaryText, { color: palette.text }]}>
                  {config.secondaryText}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                onClose();
                if (config.onPrimaryPress) config.onPrimaryPress();
              }}
              style={[styles.primary, { backgroundColor: primaryBg }]}
            >
              <Text style={[styles.primaryText, { color: primaryTextColor }]}>
                {config.primaryText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Global Context Provider ─────────────────────────────────────────────────
interface AppModalContextType {
  showAlert: (opts: ShowAlertOptions) => void;
  hideModal: () => void;
}

const AppModalContext = createContext<AppModalContextType | undefined>(undefined);

export function AppModalProvider({ children }: { children: ReactNode }) {
  const { config, show, hide } = useAppModal();

  const showAlert = (opts: ShowAlertOptions) => {
    show({
      title: opts.title,
      description: opts.description,
      type: opts.type || 'info',
      primaryText: opts.primaryText || 'OK',
      onPrimaryPress: opts.onPrimaryPress || hide,
      secondaryText: opts.secondaryText,
      onSecondaryPress: opts.onSecondaryPress,
    });
  };

  return (
    <AppModalContext.Provider value={{ showAlert, hideModal: hide }}>
      {children}
      <AppModal config={config} onClose={hide} />
    </AppModalContext.Provider>
  );
}

export function useGlobalAlert() {
  const context = useContext(AppModalContext);
  if (!context) {
    throw new Error('useGlobalAlert must be used within an AppModalProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl || 36,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.lg,
    fontFamily: Typography.family.bold,
  },
  body: {
    fontSize: Typography.sm,
    lineHeight: 20,
    fontFamily: Typography.family.regular,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  secondary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: Typography.md,
    fontFamily: Typography.family.bold,
  },
  primary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: Typography.md,
    fontFamily: Typography.family.bold,
  },
});
