'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  MessageSquare,
  MessageCircle,
  ChevronDown,
  Trash2,
  Radio,
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { subscribeNotifications } from '@/lib/notifications';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Canlı Bildirim Akışı (Faz 6.2) — komuta merkezi live feed widget'ı.
 * Şoför ekranından (ayrı sekme) yayınlanan bildirimler BroadcastChannel ile
 * burada canlı, kayan bir akış olarak listelenir.
 */
export default function LiveNotificationPanel() {
  const hydrated = useHasHydrated();
  const logs = useDeliveryStore((s) => s.notificationLogs);
  const pushNotificationLog = useDeliveryStore((s) => s.pushNotificationLog);
  const clearNotificationLogs = useDeliveryStore(
    (s) => s.clearNotificationLogs,
  );

  const [open, setOpen] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeNotifications((log) => {
      pushNotificationLog(log);
    });
    return unsubscribe;
  }, [pushNotificationLog]);

  if (!hydrated) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(23rem,calc(100vw-2rem))]">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-slate-950/40 backdrop-blur">
        {/* Başlık */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-white transition hover:bg-white/5"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
            <Radio className="h-4 w-4 text-white" />
          </span>
          <span className="flex-1">
            <span className="flex items-center gap-1.5 text-sm font-bold">
              Canlı Bildirim Akışı
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
                Live
              </span>
            </span>
            <span className="text-[11px] text-slate-400">
              SMS / WhatsApp vatandaş bildirimleri
            </span>
          </span>
          {logs.length > 0 && (
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
              {logs.length}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${
              open ? '' : 'rotate-180'
            }`}
          />
        </button>

        {open && (
          <div className="flex max-h-80 flex-col border-t border-white/10">
            <div className="flex-1 overflow-y-auto p-2.5">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-slate-500">
                  <Bell className="h-6 w-6" />
                  Şoförler durak tamamladıkça vatandaşlara giden bildirimler
                  burada canlı akacak.
                </div>
              ) : (
                <ul className="space-y-2">
                  {logs.map((log) => {
                    const isWhatsapp = log.channel === 'WHATSAPP';
                    return (
                      <li
                        key={log.id}
                        className="animate-feed-in flex gap-2.5 rounded-xl border border-white/5 bg-white/[0.04] p-2.5"
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isWhatsapp
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-sky-500/15 text-sky-400'
                          }`}
                        >
                          {isWhatsapp ? (
                            <MessageCircle className="h-4 w-4" />
                          ) : (
                            <MessageSquare className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-bold text-white">
                              {log.stopOrder}. Durak · {log.recipientName}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-slate-500">
                              {formatTime(log.createdAt)}
                            </span>
                          </div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                            {log.channel} gönderildi · {log.vehicleName}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-300">
                            {log.message}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {logs.length > 0 && (
              <div className="border-t border-white/10 p-2">
                <button
                  type="button"
                  onClick={clearNotificationLogs}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-rose-400 active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Akışı Temizle
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
