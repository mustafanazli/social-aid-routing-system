import type { NotificationLog } from '@/store/useDeliveryStore';
import { generateId } from '@/lib/utils';

/**
 * SMS/WhatsApp bildirim simülasyonu (Faz 6.2).
 * Şoför bir durağı tamamlayıp sıradakine geçince, sıradaki vatandaşa bildirim
 * "gönderilir" ve yönetici panelindeki canlı akışa düşer. Cross-tab canlılık
 * için BroadcastChannel kullanılır (şoför ve yönetici ayrı sekmelerde olabilir).
 */

const CHANNEL_NAME = 'pendik-notifications';

/** "Ahmet Yılmaz" → "Ahmet Y." (KVKK dostu kısaltma). */
export function shortenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Vatandaş';
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(' ')} ${last[0].toUpperCase()}.`;
}

/** Sıradaki durak için bildirim kaydı üretir. */
export function buildArrivalNotification(params: {
  recipientName: string;
  stopOrder: number;
  vehicleName: string;
  etaMinutes: number;
  channel?: 'SMS' | 'WHATSAPP';
}): NotificationLog {
  const { recipientName, stopOrder, vehicleName, etaMinutes } = params;
  const channel = params.channel ?? 'SMS';
  const shortName = shortenName(recipientName);

  return {
    id: generateId('ntf'),
    channel,
    recipientName: shortName,
    stopOrder,
    vehicleName,
    createdAt: new Date().toISOString(),
    message: `Sayın ${shortName}, Pendik Belediyesi yardım koliniz yakl. ${etaMinutes} dk içinde adresinize ulaşacaktır.`,
  };
}

/** BroadcastChannel destekleniyorsa döndürür, aksi halde null. */
function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  return new BroadcastChannel(CHANNEL_NAME);
}

/** Bildirimi diğer sekmelere (yönetici paneline) yayınlar. */
export function broadcastNotification(log: NotificationLog): void {
  const channel = getChannel();
  if (!channel) return;
  try {
    channel.postMessage(log);
  } finally {
    channel.close();
  }
}

/**
 * Yayınlanan bildirimleri dinler. Geriye aboneliği iptal eden fonksiyon döner.
 */
export function subscribeNotifications(
  onLog: (log: NotificationLog) => void,
): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => {};
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const handler = (event: MessageEvent<NotificationLog>) => onLog(event.data);
  channel.addEventListener('message', handler);
  return () => {
    channel.removeEventListener('message', handler);
    channel.close();
  };
}
