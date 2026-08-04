'use client';

import { useState } from 'react';
import { Pencil, Trash2, Check, X, MapPin, Clock } from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import type { SanitizedAddress } from '@/types/address';

interface DraftValues {
  recipientName: string;
  cleanAddress: string;
  neighborhood: string;
  boxCount: number;
}

/** Yüklenen ve temizlenen adreslerin onay/düzenleme tablosu. */
export default function AddressPreviewTable() {
  const addresses = useDeliveryStore((s) => s.sanitizedAddresses);
  const updateSanitizedAddress = useDeliveryStore(
    (s) => s.updateSanitizedAddress,
  );
  const removeSanitizedAddress = useDeliveryStore(
    (s) => s.removeSanitizedAddress,
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftValues | null>(null);

  const startEdit = (a: SanitizedAddress) => {
    setEditingId(a.id);
    setDraft({
      recipientName: a.recipientName,
      cleanAddress: a.cleanAddress,
      neighborhood: a.neighborhood,
      boxCount: a.boxCount,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = (id: string) => {
    if (!draft) return;
    updateSanitizedAddress(id, {
      recipientName: draft.recipientName.trim(),
      cleanAddress: draft.cleanAddress.trim(),
      neighborhood: draft.neighborhood.trim(),
      boxCount: Number.isFinite(draft.boxCount)
        ? Math.max(1, Math.round(draft.boxCount))
        : 1,
    });
    cancelEdit();
  };

  if (addresses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
        Henüz temizlenmiş adres yok. Yukarıdan bir Excel dosyası yükleyin.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th className="w-10 px-3 py-3 font-semibold">#</th>
            <th className="px-3 py-3 font-semibold">Alıcı Adı</th>
            <th className="px-3 py-3 font-semibold">Orijinal Adres</th>
            <th className="px-3 py-3 font-semibold">Temizlenmiş Adres</th>
            <th className="px-3 py-3 font-semibold">Mahalle</th>
            <th className="w-20 px-3 py-3 text-center font-semibold">Koli</th>
            <th className="w-24 px-3 py-3 text-center font-semibold">İşlem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {addresses.map((a, index) => {
            const isEditing = editingId === a.id;
            return (
              <tr
                key={a.id}
                className={isEditing ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}
              >
                <td className="px-3 py-3 align-top text-xs text-slate-400">
                  {index + 1}
                </td>

                {/* Alıcı Adı */}
                <td className="px-3 py-3 align-top">
                  {isEditing ? (
                    <input
                      value={draft?.recipientName ?? ''}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, recipientName: e.target.value } : d,
                        )
                      }
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  ) : (
                    <div>
                      <span className="font-medium text-slate-800">
                        {a.recipientName || '—'}
                      </span>
                      {a.timeWindow && (
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-violet-600">
                          <Clock className="h-3 w-3" />
                          {a.timeWindow}
                        </span>
                      )}
                    </div>
                  )}
                </td>

                {/* Orijinal Adres */}
                <td className="max-w-[220px] px-3 py-3 align-top text-xs text-slate-500">
                  {a.originalText || '—'}
                </td>

                {/* Temizlenmiş Adres */}
                <td className="max-w-[280px] px-3 py-3 align-top">
                  {isEditing ? (
                    <textarea
                      value={draft?.cleanAddress ?? ''}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, cleanAddress: e.target.value } : d,
                        )
                      }
                      rows={3}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  ) : (
                    <span className="text-slate-700">{a.cleanAddress}</span>
                  )}
                </td>

                {/* Mahalle */}
                <td className="px-3 py-3 align-top">
                  {isEditing ? (
                    <input
                      value={draft?.neighborhood ?? ''}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, neighborhood: e.target.value } : d,
                        )
                      }
                      className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  ) : a.neighborhood ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <MapPin className="h-3 w-3" />
                      {a.neighborhood}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">Belirsiz</span>
                  )}
                </td>

                {/* Koli Sayısı */}
                <td className="px-3 py-3 text-center align-top">
                  {isEditing ? (
                    <input
                      type="number"
                      min={1}
                      value={draft?.boxCount ?? 1}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, boxCount: Number(e.target.value) } : d,
                        )
                      }
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  ) : (
                    <span className="inline-flex min-w-[1.75rem] justify-center rounded-md bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-700">
                      {a.boxCount}
                    </span>
                  )}
                </td>

                {/* İşlem */}
                <td className="px-3 py-3 align-top">
                  <div className="flex items-center justify-center gap-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(a.id)}
                          title="Kaydet"
                          className="rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-100"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          title="Vazgeç"
                          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(a)}
                          title="Düzenle"
                          className="rounded-md p-1.5 text-slate-500 transition hover:bg-sky-100 hover:text-sky-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSanitizedAddress(a.id)}
                          title="Sil"
                          className="rounded-md p-1.5 text-slate-500 transition hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
