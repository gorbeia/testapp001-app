import { authFetch } from '@/lib/api';

export interface CreateNotificationData {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  targetUserId?: string; // If not provided, creates for current user
  defaultLanguage?: string; // Default: 'eu'
  messages?: { [language: string]: { title: string; message: string } }; // Multilingual messages
}

/**
 * Create a notification for a user
 * @param data Notification data
 * @returns Promise with created notification
 */
export async function createNotification(data: CreateNotificationData) {
  const response = await authFetch('/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create notification');
  }

  return response.json();
}

/**
 * Create a notification for a reservation
 */
export async function createReservationNotification(
  userId: string,
  reservationName: string,
  type: 'created' | 'cancelled' | 'confirmed',
  messages?: { [language: string]: { title: string; message: string } },
  defaultLanguage: string = 'eu'
) {
  const baseMessages = {
    created: {
      title: 'Erreserba berria',
      message: `Zure "${reservationName}" erreserba ondo egin da.`,
      type: 'success' as const,
    },
    cancelled: {
      title: 'Erreserba ezeztatua',
      message: `Zure "${reservationName}" erreserba ezeztatu egin da.`,
      type: 'warning' as const,
    },
    confirmed: {
      title: 'Erreserba konfirmatua',
      message: `Zure "${reservationName}" erreserba konfirmatua izan da.`,
      type: 'success' as const,
    },
  };

  const baseMessage = baseMessages[type];

  return createNotification({
    title: messages?.[defaultLanguage]?.title || baseMessage.title,
    message: messages?.[defaultLanguage]?.message || baseMessage.message,
    type: baseMessage.type,
    targetUserId: userId,
    defaultLanguage,
    messages,
  });
}

/**
 * Create a notification for debt/payment
 */
export async function createDebtNotification(
  userId: string,
  amount: number,
  type: 'new_debt' | 'payment_received',
  messages?: { [language: string]: { title: string; message: string } },
  defaultLanguage: string = 'eu'
) {
  const baseMessages = {
    new_debt: {
      title: 'Zor berria',
      message: `${amount}€-ko zorra gehitu zaizu kontuan.`,
      type: 'warning' as const,
    },
    payment_received: {
      title: 'Ordainketa jasota',
      message: `${amount}€-ko ordainketa jaso dugu. Eskerrik asko!`,
      type: 'success' as const,
    },
  };

  const baseMessage = baseMessages[type];

  return createNotification({
    title: messages?.[defaultLanguage]?.title || baseMessage.title,
    message: messages?.[defaultLanguage]?.message || baseMessage.message,
    type: baseMessage.type,
    targetUserId: userId,
    defaultLanguage,
    messages,
  });
}

/**
 * Create a notification for general announcements
 */
export async function createAnnouncementNotification(
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  messages?: { [language: string]: { title: string; message: string } },
  defaultLanguage: string = 'eu'
) {
  return createNotification({
    title: messages?.[defaultLanguage]?.title || title,
    message: messages?.[defaultLanguage]?.message || message,
    type,
    defaultLanguage,
    messages,
  });
}
