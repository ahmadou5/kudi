import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

export type NotificationEventType =
  | 'DEPOSIT_RECEIVED'
  | 'SPEND_COMPLETED'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  | 'BILL_PAYMENT_SUCCESS'
  | 'VIRTUAL_CARD_CREATED';

export type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

function formatNGN(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildNotificationPayload(type: NotificationEventType, payload: Record<string, unknown>): NotificationPayload {
  switch (type) {
    case 'DEPOSIT_RECEIVED':
      return {
        title: 'Deposit Received! 💰',
        body: `You received ${payload.amountUSDC ?? 0} USDC into your Kudi wallet balance.`,
        data: payload,
      };
    case 'SPEND_COMPLETED':
      return {
        title: 'Instant Payout Completed 🚀',
        body: `Successfully sent ${formatNGN(Number(payload.amountNGN ?? 0))} to ${payload.recipientAccountName ?? 'recipient'}.`,
        data: payload,
      };
    case 'KYC_APPROVED':
      return {
        title: 'KYC Verified ✅',
        body: `Congratulations! Your identity has been verified and your dedicated Virtual Account is ready.`,
        data: payload,
      };
    case 'KYC_REJECTED':
      return {
        title: 'KYC Action Required ⚠️',
        body: `Your identity verification could not be completed. Reason: ${payload.reason ?? 'Verification issue'}.`,
        data: payload,
      };
    case 'BILL_PAYMENT_SUCCESS':
      return {
        title: 'Bill Payment Successful ⚡',
        body: `Your ${payload.billType ?? 'utility'} payment of ${formatNGN(Number(payload.amountNGN ?? 0))} was completed.`,
        data: payload,
      };
    case 'VIRTUAL_CARD_CREATED':
      return {
        title: 'Virtual Card Issued 💳',
        body: `Your virtual card ending in ${payload.last4 ?? '0000'} is active and ready for online spending.`,
        data: payload,
      };
    default:
      return {
        title: 'Kudi Update 🔔',
        body: 'You have a new transaction update on Kudi.',
        data: payload,
      };
  }
}

export async function sendPushNotification(expoPushToken: string, type: NotificationEventType, payloadData: Record<string, unknown>) {
  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.warn(`[Expo Push] Invalid Expo push token: ${expoPushToken}`);
    return { success: false, error: 'INVALID_PUSH_TOKEN' };
  }

  const payload = buildNotificationPayload(type, payloadData);
  const messages: ExpoPushMessage[] = [
    {
      to: expoPushToken,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
      priority: 'high',
      channelId: 'default',
    },
  ];

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    return { success: true, tickets };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Expo Push Error] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}
