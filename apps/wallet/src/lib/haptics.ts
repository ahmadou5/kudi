import * as Haptics from 'expo-haptics';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotificationType = 'success' | 'warning' | 'error';

const IMPACT_STYLES: Record<ImpactStyle, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  rigid: Haptics.ImpactFeedbackStyle.Rigid,
  soft: Haptics.ImpactFeedbackStyle.Soft
};

const NOTIFICATION_TYPES: Record<NotificationType, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error
};

let failures = 0;
let nativeResolved = false;

const describe = (err: unknown): string =>
  err instanceof Error ? `${err.name}: ${err.message}` : String(err);

const succeeded = (action: string) => {
  if (nativeResolved) return;
  nativeResolved = true;
  console.log(`[Haptics] native call resolved (${action})`);
};

const failed = (action: string, err: unknown) => {
  failures += 1;
  if (failures > 5) return;
  console.warn(`[Haptics] ${action} failed (attempt ${failures}) — ${describe(err)}`);
  if (failures === 1) {
    console.warn('[Haptics] if this says UnavailabilityError, the native module is not in this build');
  }
};

export const haptics = {
  tap: () =>
    Haptics.selectionAsync().then(
      () => succeeded('tap'),
      (err) => failed('tap', err)
    ),
  impact: (style: ImpactStyle = 'light') =>
    Haptics.impactAsync(IMPACT_STYLES[style]).then(
      () => succeeded(`impact:${style}`),
      (err) => failed(`impact:${style}`, err)
    ),
  notify: (type: NotificationType = 'success') =>
    Haptics.notificationAsync(NOTIFICATION_TYPES[type]).then(
      () => succeeded(`notify:${type}`),
      (err) => failed(`notify:${type}`, err)
    )
};

export const hapticsDiagnostics = async () => {
  const expoHaptics = (Haptics as unknown as Record<string, unknown>);
  console.log('[Haptics] module surface:', Object.keys(expoHaptics).join(', ') || 'none');
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    console.log('[Haptics] diagnostic vibration dispatched — if you felt nothing, check system vibration settings');
  } catch (err) {
    console.warn(`[Haptics] diagnostic failed — ${describe(err)}`);
  }
};
